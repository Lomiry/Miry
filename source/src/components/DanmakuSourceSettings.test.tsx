// @vitest-environment jsdom
import { useState } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import DanmakuSourceSettings from "./DanmakuSourceSettings";
import { normalizeSources, type SourceSettings } from "../danmaku/sources";
import {
  readSettings,
  saveSettings,
  applySettingsUpdate,
} from "../stores/settings";
import { normalizeDanmaku } from "../danmaku/types";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(),
}));
type Key = { endpoint: string; token: string };
type Args = {
  sourceId: string;
  endpoint: string;
  token?: string;
  action: string;
  transaction?: string;
};
const vault = new Map<string, Key>();
const receipts = new Map<string, Key | undefined>();
let fail: string | undefined;
async function native(command: string, input: unknown) {
  if (command === "danmaku_source_request")
    return { success: true, animes: [] };
  const a = {
    ...(input as Args),
    endpoint: (input as Args).endpoint.replace(/\/+$/, ""),
  };
  if (a.action === "status")
    return { state: vault.has(a.sourceId) ? "saved" : "missing" };
  if (a.action === "rollback") {
    const old = receipts.get(a.transaction!);
    if (old) vault.set(a.sourceId, old);
    else vault.delete(a.sourceId);
    receipts.delete(a.transaction!);
    return { state: "finished" };
  }
  if (a.action === "finish") {
    receipts.delete(a.transaction!);
    return { state: "finished" };
  }
  if (fail) throw fail;
  const previous = vault.get(a.sourceId);
  if (a.action === "save") {
    if (!a.token && previous?.endpoint !== a.endpoint)
      throw "credential-endpoint";
    vault.set(a.sourceId, {
      endpoint: a.endpoint,
      token: a.token || previous!.token,
    });
  } else vault.delete(a.sourceId);
  const transaction = crypto.randomUUID();
  receipts.set(transaction, previous);
  return { state: a.action === "save" ? "saved" : "missing", transaction };
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vault.clear();
  receipts.clear();
  fail = undefined;
  vi.mocked(invoke).mockReset().mockImplementation(native);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Settings() {
  const [value, setValue] = useState<SourceSettings>(() =>
    normalizeSources(readSettings().danmaku?.sources),
  );
  return (
    <DanmakuSourceSettings
      value={value}
      onChange={(update) => {
        const next = applySettingsUpdate((current) => ({
          ...current,
          danmaku: normalizeDanmaku({
            ...current.danmaku,
            sources: update(normalizeSources(current.danmaku?.sources)),
          }),
        }));
        setValue(normalizeSources(next.danmaku?.sources));
      }}
    />
  );
}
const tokenInput = () =>
  screen.getByLabelText("普通TOKEN（留空保留已保存密钥）");
const urlInput = () =>
  screen.getByLabelText("服务地址（不含 TOKEN 和 /api/v2）");
function add(token: string = crypto.randomUUID()) {
  fireEvent.click(
    screen.getByRole("button", { name: "添加 LogVar / 兼容 API" }),
  );
  fireEvent.change(urlInput(), {
    target: { value: "https://danmaku.example.com" },
  });
  fireEvent.change(tokenInput(), { target: { value: token } });
}
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "保存来源" }));
const saved = () =>
  waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("来源已保存"),
  );
const lanConsent = () =>
  screen.getByLabelText("我了解风险，允许此来源使用局域网HTTP");
it("groups source information, security, behavior and explanatory text without mixing priority and consent", () => {
  render(<Settings />);
  add();
  const groups = Array.from(
    document.querySelectorAll(".danmaku-source-editor fieldset.source-group"),
  );
  expect(
    groups.map((group) => group.querySelector("legend")?.textContent),
  ).toEqual([
    "来源基本信息",
    "TOKEN 与凭据",
    "来源行为",
    "HTTP 授权与连接安全",
  ]);
  expect(groups[0].contains(urlInput())).toBe(true);
  expect(groups[0].contains(tokenInput())).toBe(false);
  expect(groups[1].contains(tokenInput())).toBe(true);
  expect(groups[1].querySelector(".source-key-state")).toBeTruthy();
  expect(groups[2].querySelector('input[type="number"]')).toBeTruthy();
  expect(groups[2].querySelector('input[type="checkbox"]')).toBeTruthy();
  expect(groups[1].querySelector('input[type="number"]')).toBeNull();
  expect(document.querySelector(".source-selection")).toBeTruthy();
  expect(document.querySelector(".source-behavior-list")).toBeTruthy();
  expect(document.querySelector(".source-notes")).toBeTruthy();
});
it("requires explicit LAN HTTP consent, saves it with the source and restores it without a new prompt", async () => {
  render(<Settings />);
  const token = crypto.randomUUID();
  add(token);
  fireEvent.change(urlInput(), {
    target: { value: "http://192.168.50.1:9321/" },
  });
  expect(screen.getByText(/TOKEN传输不会加密/)).toBeTruthy();
  expect((lanConsent() as HTMLInputElement).checked).toBe(false);
  save();
  expect(screen.getByRole("status").textContent).toContain(
    "请先确认局域网HTTP传输风险",
  );
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.click(lanConsent());
  save();
  await saved();
  const source = readSettings().danmaku!.sources!.sources[1];
  expect(source).toMatchObject({
    endpoint: "http://192.168.50.1:9321",
    allowLanHttp: true,
  });
  expect(source.id).toBeTruthy();
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_key",
    expect.objectContaining({ action: "save", allowLanHttp: true }),
  );
  expect(localStorage.getItem("miry-settings")).not.toContain(token);
  expect(sessionStorage.length).toBe(0);
  cleanup();
  render(<Settings />);
  await edit();
  expect((lanConsent() as HTMLInputElement).checked).toBe(true);
  expect((tokenInput() as HTMLInputElement).value).toBe("");
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_key",
    expect.objectContaining({ action: "status", allowLanHttp: true }),
  );
  save();
  await saved();
  expect(readSettings().danmaku!.sources!.sources[1].id).toBe(source.id);
});
it("resets LAN consent on target changes and never offers a public HTTP override", async () => {
  render(<Settings />);
  add();
  fireEvent.change(urlInput(), {
    target: { value: "http://10.0.0.2:9321/proxy" },
  });
  fireEvent.click(lanConsent());
  fireEvent.change(urlInput(), {
    target: { value: "http://10.0.0.2:9321/proxy/" },
  });
  expect((lanConsent() as HTMLInputElement).checked).toBe(true);
  fireEvent.change(urlInput(), {
    target: { value: "http://10.0.0.3:9321/proxy" },
  });
  expect((lanConsent() as HTMLInputElement).checked).toBe(false);
  save();
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.change(urlInput(), {
    target: { value: "http://public.example.test" },
  });
  expect(
    screen.queryByLabelText("我了解风险，允许此来源使用局域网HTTP"),
  ).toBeNull();
  save();
  expect(screen.getByRole("status").textContent).toContain("服务地址格式无效");
  expect(invoke).not.toHaveBeenCalled();
});
it("does not save a supplied TOKEN that is already part of the service path", () => {
  render(<Settings />);
  const token = crypto.randomUUID();
  add(token);
  fireEvent.change(urlInput(), {
    target: { value: `https://danmaku.example.test/${token}` },
  });
  save();
  expect(screen.getByRole("status").textContent).toContain("服务地址格式无效");
  expect(invoke).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).not.toContain(token);
});
function existing(withToken = true) {
  const source = {
    id: "custom",
    name: "Custom",
    protocol: "logvar" as const,
    endpoint: "https://danmaku.example.com",
    priority: 2,
    enabled: true,
  };
  if (withToken)
    vault.set(source.id, {
      endpoint: source.endpoint,
      token: crypto.randomUUID(),
    });
  saveSettings({
    ...readSettings(),
    danmaku: normalizeDanmaku({
      sources: normalizeSources({ mode: "auto", sources: [source] }),
    }),
  });
  return source;
}
async function edit() {
  await waitFor(() =>
    expect(screen.queryByText("正在读取凭据状态…")).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
}
it("reports a successful save, refreshes options and retains the selected DandanPlay mode", async () => {
  render(<Settings />);
  const token = crypto.randomUUID();
  add(token);
  save();
  await saved();
  expect(readSettings().danmaku?.sources?.sources).toHaveLength(2);
  expect(readSettings().danmaku?.sources?.mode).toBe("dandanplay");
  fireEvent.click(screen.getByRole("combobox"));
  expect(screen.getByRole("option", { name: "LogVar" })).toBeTruthy();
  expect(screen.queryByLabelText("名称")).toBeNull();
  expect(localStorage.getItem("miry-settings")).not.toContain(token);
  expect(sessionStorage.getItem("miry-settings") || "").not.toContain(token);
});
it("reports a failed settings write even after the change callback starts and rolls back credentials", async () => {
  render(
    <DanmakuSourceSettings
      onChange={() => {
        throw Error(crypto.randomUUID());
      }}
    />,
  );
  add();
  save();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "来源保存失败：本地设置不可写",
    ),
  );
  expect(vault.size).toBe(0);
  expect(invoke).toHaveBeenCalledWith(
    "danmaku_source_key",
    expect.objectContaining({ action: "rollback" }),
  );
  expect(
    (screen.getByRole("button", { name: "保存来源" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("preserves blank saved tokens while renaming, changing priority and disabling", async () => {
  const source = existing();
  const token = vault.get(source.id)!.token;
  render(<Settings />);
  await edit();
  expect((tokenInput() as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("名称"), {
    target: { value: "Renamed" },
  });
  fireEvent.change(
    screen
      .getAllByLabelText("优先级")
      .find((e) => !(e as HTMLInputElement).disabled)!,
    { target: { value: "7" } },
  );
  fireEvent.click(screen.getByLabelText("启用此来源"));
  save();
  await saved();
  expect(vault.get(source.id)?.token === token).toBe(true);
  expect(
    readSettings().danmaku?.sources?.sources.find((s) => s.id === source.id),
  ).toMatchObject({ name: "Renamed", priority: 7, enabled: false });
  expect(localStorage.getItem("miry-settings")).not.toContain(token);
});
it("updates a token without echoing it and explicitly clears it", async () => {
  const source = existing();
  render(<Settings />);
  await edit();
  const replacement = crypto.randomUUID();
  fireEvent.change(tokenInput(), { target: { value: replacement } });
  save();
  await saved();
  expect(vault.get(source.id)?.token === replacement).toBe(true);
  await edit();
  expect((tokenInput() as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "清除已保存TOKEN" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("已清除TOKEN"),
  );
  expect(vault.has(source.id)).toBe(false);
  save();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("未配置普通TOKEN"),
  );
});
it("deletes the credential when deleting its source", async () => {
  const source = existing();
  render(<Settings />);
  await waitFor(() =>
    expect(screen.queryByText("正在读取凭据状态…")).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("已删除"),
  );
  expect(vault.has(source.id)).toBe(false);
  expect(readSettings().danmaku?.sources?.sources).toHaveLength(1);
});
it("handles empty or invalid URLs, invalid names and missing TOKEN with specific errors", () => {
  render(<Settings />);
  add("");
  fireEvent.change(urlInput(), { target: { value: "" } });
  save();
  expect(screen.getByRole("status").textContent).toContain(
    "请输入LogVar服务地址",
  );
  fireEvent.change(urlInput(), {
    target: { value: "http://remote.example.com" },
  });
  save();
  expect(screen.getByRole("status").textContent).toContain("服务地址格式无效");
  fireEvent.change(urlInput(), {
    target: { value: "https://danmaku.example.com" },
  });
  fireEvent.change(screen.getByLabelText("名称"), { target: { value: " " } });
  save();
  expect(screen.getByRole("status").textContent).toContain("来源名称");
  fireEvent.change(screen.getByLabelText("名称"), {
    target: { value: "LogVar" },
  });
  save();
  expect(screen.getByRole("status").textContent).toContain("未配置普通TOKEN");
  expect(invoke).not.toHaveBeenCalled();
});
it("preserves anonymous API support only after an explicit choice", async () => {
  render(<Settings />);
  add("");
  fireEvent.click(
    screen.getByLabelText("此接口无需TOKEN（保存时清除已有密钥）"),
  );
  save();
  await saved();
  expect(readSettings().danmaku?.sources?.sources[1].anonymous).toBe(true);
  expect(vault.size).toBe(0);
});
it("prevents duplicate submission while a native save is pending", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(invoke).mockImplementation(async (cmd, raw) => {
    if ((raw as Args).action === "save") await gate;
    return native(cmd, raw);
  });
  render(<Settings />);
  add();
  save();
  save();
  expect(
    (screen.getByRole("button", { name: "保存来源" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  release();
  await saved();
  expect(readSettings().danmaku?.sources?.sources).toHaveLength(2);
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([, a]) => (a as Args).action === "save"),
  ).toHaveLength(1);
});
it("does not claim success after encryption failure", async () => {
  fail = "credential-encrypt";
  render(<Settings />);
  add();
  save();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "Windows用户级加密失败",
    ),
  );
  expect(readSettings().danmaku?.sources).toBeUndefined();
  expect(
    (screen.getByRole("button", { name: "保存来源" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("does not silently reuse a saved key at a changed endpoint", async () => {
  const source = existing();
  const before = vault.get(source.id);
  render(<Settings />);
  await edit();
  fireEvent.change(urlInput(), {
    target: { value: "https://other.example.com" },
  });
  save();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("服务地址已改变"),
  );
  expect(vault.get(source.id)).toBe(before);
});
it("loads old tokenless sources without deleting them", async () => {
  existing(false);
  render(<Settings />);
  await edit();
  save();
  expect(screen.getByRole("status").textContent).toContain("未配置普通TOKEN");
  expect(readSettings().danmaku?.sources?.sources).toHaveLength(2);
});
it("shows read failure and requires an explicit replacement action", async () => {
  existing();
  vi.mocked(invoke).mockImplementation(async (cmd, raw) =>
    (raw as Args).action === "status"
      ? { state: "unavailable" }
      : native(cmd, raw),
  );
  render(<Settings />);
  await edit();
  save();
  expect(screen.getByRole("status").textContent).toContain("旧密文未被覆盖");
  fireEvent.change(tokenInput(), { target: { value: crypto.randomUUID() } });
  fireEvent.click(
    screen.getByRole("button", { name: "替换无法读取的密钥并保存来源" }),
  );
  await saved();
});
it("rolls back a late native result after the editor unmounts", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  vi.mocked(invoke).mockImplementation(async (cmd, raw) => {
    const result = await native(cmd, raw);
    if ((raw as Args).action === "save") await gate;
    return result;
  });
  const change = vi.fn();
  const view = render(<DanmakuSourceSettings onChange={change} />);
  add();
  save();
  view.unmount();
  release();
  await waitFor(() => expect(vault.size).toBe(0));
  expect(change).not.toHaveBeenCalled();
});
it("health checks remain explicit and hide remote error contents", async () => {
  existing(false);
  render(<Settings />);
  await waitFor(() =>
    expect(screen.queryByText("正在读取凭据状态…")).toBeNull(),
  );
  expect(
    vi.mocked(invoke).mock.calls.every(([cmd]) => cmd === "danmaku_source_key"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "检查连接" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("接口连接正常"),
  );
  const secret = crypto.randomUUID();
  vi.mocked(invoke).mockRejectedValueOnce(Error(secret));
  fireEvent.click(screen.getByRole("button", { name: "检查连接" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("连接检查失败"),
  );
  expect(screen.getByRole("status").textContent).not.toContain(secret);
});
it("rolls back credentials when actual localStorage writes are denied", async () => {
  render(<Settings />);
  add();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error(crypto.randomUUID());
  });
  save();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("本地设置不可写"),
  );
  expect(vault.size).toBe(0);
  expect(localStorage.getItem("miry-settings")).toBeNull();
});
it("rejects editing a source removed by another settings update", async () => {
  const source = existing();
  const onChange = vi.fn();
  const view = render(
    <DanmakuSourceSettings
      value={normalizeSources({ sources: [source] })}
      onChange={onChange}
    />,
  );
  await edit();
  view.rerender(
    <DanmakuSourceSettings
      value={normalizeSources(undefined)}
      onChange={onChange}
    />,
  );
  save();
  expect(screen.getByRole("status").textContent).toContain(
    "来源已被删除或修改",
  );
  expect(onChange).not.toHaveBeenCalled();
});
