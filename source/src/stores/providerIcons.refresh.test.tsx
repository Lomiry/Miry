// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import ServerIcon from "../components/ServerIcon";
import embyIcon from "../assets/emby.svg";
import { saveIconPreference } from "./providerIcons";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const account = {
  server: "https://alpha.example.test",
  serverId: "s",
  userId: "u",
  name: "login-user",
  token: "synthetic",
  deviceId: "d",
  remark: "Alpha",
};
const icons = [
  { name: "Alpha", url: "https://icons.example.test/alpha.png" },
  { name: "Beta", url: "https://icons.example.test/beta.png" },
  { name: "Ok-emby", url: "https://icons.example.test/ok.png" },
];
function catalog() {
  localStorage.setItem(
    "miry-provider-icon-catalog",
    JSON.stringify({ at: Date.now(), icons }),
  );
}
it("matches domain before display names and preset name aliases, and falls back to local Emby", () => {
  catalog();
  const view = render(<ServerIcon account={account} />);
  expect(view.container.querySelector("img")?.src).toContain("/alpha.png");
  view.rerender(<ServerIcon account={{ ...account, remark: "Beta" }} />);
  expect(view.container.querySelector("img")?.src).toContain("/alpha.png");
  view.rerender(
    <ServerIcon
      account={{
        ...account,
        remark: "unknown",
        server: "https://beta.example.test",
      }}
    />,
  );
  expect(view.container.querySelector("img")?.src).toContain("/beta.png");
  view.rerender(
    <ServerIcon
      account={{
        ...account,
        remark: "OKEmby",
        server: "https://unknown.example.test",
      }}
    />,
  );
  expect(view.container.querySelector("img")?.src).toContain("/ok.png");
  view.rerender(
    <ServerIcon
      account={{
        ...account,
        remark: "unknown",
        server: "https://unknown.example.test",
      }}
    />,
  );
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
    embyIcon,
  );
});
it("a failure of an old image cannot replace a new target, and target changes retry the same image", () => {
  catalog();
  const view = render(<ServerIcon account={account} />);
  const previous = view.container.querySelector("img")!;
  fireEvent.error(previous);
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
    embyIcon,
  );
  view.rerender(
    <ServerIcon
      account={{ ...account, server: "https://another.example.test" }}
    />,
  );
  expect(view.container.querySelector("img")?.src).toContain("/alpha.png");
  view.rerender(<ServerIcon account={{ ...account, remark: "Beta" }} />);
  fireEvent.error(previous);
  expect(view.container.querySelector("img")?.src).toContain("/alpha.png");
});
it("manual icon/provider selections win without leaking identity into matching", () => {
  catalog();
  saveIconPreference(account, {
    provider: "Alpha",
    override: "https://icons.example.test/manual.png",
  });
  const view = render(<ServerIcon account={{ ...account, remark: "Beta" }} />);
  expect(view.container.querySelector("img")?.src).toContain("/manual.png");
});
