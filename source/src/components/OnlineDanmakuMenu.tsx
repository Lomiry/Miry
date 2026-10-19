import { useEffect, useRef, useState } from "react";
import { isComposingKey } from "../player/shortcuts";
import type { DanmakuPresentation } from "../danmaku/types";
import type { PlayerAction } from "../player/uiModel";
export default function OnlineDanmakuMenu({
  value,
  dispatch,
}: {
  value: DanmakuPresentation;
  dispatch: (action: PlayerAction) => Promise<void>;
}) {
  const online = value.online,
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(online?.query || "");
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (search) input.current?.focus();
  }, [search]);
  useEffect(() => {
    setQuery(online?.query || "");
    setSearch(false);
  }, [online?.query]);
  if (!online) return null;
  const run = (
    command: Extract<PlayerAction, { kind: "danmaku" }>["command"],
    extra = {},
  ) => void dispatch({ kind: "danmaku", command, ...extra });
  const enabled = value.settings.onlineEnabled !== false;
  return (
    <div className="online-danmaku-menu">
      <small>
        在线匹配 · 弹弹play开放弹幕网络{online.mock ? " · 本地测试服务" : ""}
      </small>
      <p className="player-menu-note" role="status">
        {(enabled ? online.status : "在线弹幕已关闭")
          .split("\n")
          .map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
      </p>
      {!online.configured && !online.builtIn ? (
        <button className="secondary" onClick={() => run("configure")}>
          配置已授权的服务凭据
        </button>
      ) : (
        <>
          <div className="danmaku-file-actions">
            <button
              className="secondary"
              disabled={!enabled || online.loading}
              onClick={() => setSearch(!search)}
            >
              搜索其他弹幕
            </button>
            {online.match && (
              <button
                className="secondary"
                disabled={!enabled || online.loading}
                onClick={() => {
                  setSearch(true);
                }}
              >
                更换匹配
              </button>
            )}
            {online.match && (
              <button
                className="secondary"
                disabled={!enabled || online.loading}
                onClick={() => run("reload")}
              >
                重新加载在线弹幕
              </button>
            )}
            {online.match && value.source === "local" && (
              <button
                className="secondary"
                disabled={!enabled || online.loading}
                onClick={() => run("online")}
              >
                使用在线弹幕
              </button>
            )}
          </div>
          {search && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !composing.current &&
                  enabled &&
                  !online.loading &&
                  query.trim().length >= 2
                )
                  run("search", { query: query.trim() });
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (composing.current || isComposingKey(e.nativeEvent))
                )
                  e.preventDefault();
              }}
            >
              <input
                ref={input}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={() => {
                  composing.current = false;
                }}
                aria-label="在线弹幕搜索"
                value={query}
                maxLength={200}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                className="secondary"
                disabled={!enabled || online.loading || query.trim().length < 2}
              >
                搜索
              </button>
            </form>
          )}
          <div className="online-danmaku-candidates">
            {online.candidates.slice(0, 20).map((m) => (
              <button
                key={m.id}
                className="player-menu-option"
                disabled={!enabled || online.loading}
                onClick={() => run("select", { matchId: m.id })}
              >
                <span>
                  {m.title}
                  {m.year ? ` · ${m.year}` : ""}
                  {m.recommended && (
                    <strong className="danmaku-recommended">推荐</strong>
                  )}
                  {m.reason && <small>{m.reason}</small>}
                  <small>
                    {m.season ? `S${String(m.season).padStart(2, "0")}` : ""}
                    {m.episode
                      ? `E${String(m.episode).padStart(2, "0")}`
                      : ""}{" "}
                    · {m.episodeTitle} · 弹弹play
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!online.builtIn && (
            <details>
              <summary>服务配置</summary>
              <button className="secondary" onClick={() => run("configure")}>
                更换凭据
              </button>
              <button
                className="secondary"
                onClick={() => run("clear-credential")}
              >
                清除本次运行凭据
              </button>
            </details>
          )}
        </>
      )}
    </div>
  );
}
