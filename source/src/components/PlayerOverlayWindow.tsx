import { useEffect, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { PlayerAction, PlayerUiModel } from "../player/uiModel";
import PlayerChrome from "./PlayerChrome";
import DanmakuLayer from "../danmaku/DanmakuLayer";
import { isEditableTarget } from "../player/shortcuts";
import {
  danmakuDefaults,
  type DanmakuClock,
  type DanmakuDocument,
} from "../danmaku/types";

export default function PlayerOverlayWindow() {
  const [model, setModel] = useState<PlayerUiModel | null>(null);
  const [danmaku, setDanmaku] = useState<DanmakuDocument | null>(null);
  const [clock, setClock] = useState<DanmakuClock | null>(null);
  const requests = useRef(
    new Map<
      string,
      {
        resolve: () => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const sequence = useRef(0);
  const keyboardFrame = useRef(0);
  useEffect(() => {
    let active = true;
    const removers: (() => void)[] = [];
    const track = (promise: Promise<() => void>) =>
      promise.then((fn) => {
        if (active) removers.push(fn);
        else fn();
      });
    void Promise.all([
      track(
        listen(
          "player-ui-dispose",
          () => {
            if (!active) return;
            setModel(null);
            setDanmaku(null);
            setClock(null);
            cancelAnimationFrame(keyboardFrame.current);
            requests.current.forEach((r) => {
              clearTimeout(r.timer);
              r.resolve();
            });
            requests.current.clear();
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen(
          "player-ui-dismiss",
          () => {
            if (active)
              document.dispatchEvent(new Event("player-overlay-dismiss"));
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen<DanmakuDocument | null>(
          "player-danmaku-data",
          ({ payload }) => {
            if (active) setDanmaku(payload);
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen<DanmakuClock | null>(
          "player-danmaku-clock",
          ({ payload }) => {
            if (active) setClock(payload);
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen<PlayerUiModel>(
          "player-ui-state",
          ({ payload }) => {
            if (active) setModel(payload);
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen(
          "player-ui-ping",
          () => {
            if (active) void emitTo("main", "player-ui-ready", {});
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen<{
          key: string;
          code: string;
          shiftKey: boolean;
          ctrlKey?: boolean;
          altKey?: boolean;
          metaKey?: boolean;
        }>(
          "player-ui-key",
          ({ payload }) => {
            if (!active) return;
            if (
              isEditableTarget(document.activeElement) &&
              payload.key !== "Escape"
            )
              return;
            // Forwarded keys have a different focus owner; stale button focus
            // must not swallow Space or synthesize a click.
            const target = document.body;
            target.dispatchEvent(
              new KeyboardEvent("keydown", {
                ...payload,
                bubbles: true,
                cancelable: true,
              }),
            );
            if (payload.key === "Tab")
              keyboardFrame.current = requestAnimationFrame(() => {
                const buttons = Array.from(
                  document.querySelectorAll<HTMLButtonElement>(
                    ".player-heading button:not(:disabled), .player-console button:not(:disabled)",
                  ),
                );
                buttons[payload.shiftKey ? buttons.length - 1 : 0]?.focus();
              });
          },
          { target: "player-ui" },
        ),
      ),
      track(
        listen<{ id: string; error: string }>(
          "player-ui-result",
          ({ payload }) => {
            const request = requests.current.get(payload.id);
            if (!request) return;
            clearTimeout(request.timer);
            requests.current.delete(payload.id);
            if (payload.error) request.reject(new Error(payload.error));
            else request.resolve();
          },
          { target: "player-ui" },
        ),
      ),
    ])
      .then(() => {
        if (active) void emitTo("main", "player-ui-ready", {});
      })
      .catch(() => {});
    return () => {
      active = false;
      cancelAnimationFrame(keyboardFrame.current);
      removers.forEach((fn) => fn());
      requests.current.forEach((r) => {
        clearTimeout(r.timer);
        r.reject(new Error("控制层已关闭"));
      });
      requests.current.clear();
    };
  }, []);
  const dispatch = (action: PlayerAction) =>
    new Promise<void>((resolve, reject) => {
      const id = String(++sequence.current);
      const timer = setTimeout(
        () => {
          requests.current.delete(id);
          reject(new Error("操作超时，请重试。"));
        },
        action.kind === "danmaku" && action.command === "choose"
          ? 300000
          : 30000,
      );
      requests.current.set(id, { resolve, reject, timer });
      void emitTo("main", "player-ui-action", { id, action }).catch((e) => {
        clearTimeout(timer);
        requests.current.delete(id);
        reject(e);
      });
    });
  return model ? (
    <section
      className="player-overlay-root"
      aria-label="播放器控制"
      onFocusCapture={(event) => {
        if (isEditableTarget(event.target))
          void emitTo("main", "player-ui-focus", {}).catch(() => {});
      }}
      onPointerDownCapture={(event) => {
        if (isEditableTarget(event.target))
          void emitTo("main", "player-ui-focus", {}).catch(() => {});
      }}
    >
      <DanmakuLayer
        document={danmaku}
        clock={clock}
        settings={
          model.danmaku
            ? { ...model.danmaku.settings, offset: model.danmaku.offset }
            : danmakuDefaults
        }
      />
      <PlayerChrome model={model} dispatch={dispatch} owned />
    </section>
  ) : null;
}
