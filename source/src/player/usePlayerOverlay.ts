import { t, getLanguage } from "../i18n/core";
import { useI18n } from "../i18n/react";
import { useEffect, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  presentationModel,
  type PlayerAction,
  type PlayerUiModel,
} from "./uiModel";
import { blockedShortcut, keyCode, validKey } from "./shortcuts";
import type { DanmakuClock, DanmakuDocument } from "../danmaku/types";

export function usePlayerOverlay(
  enabled: boolean,
  model: PlayerUiModel | null,
  action: (value: PlayerAction) => Promise<void>,
  danmaku?: { document: DanmakuDocument | null; clock: DanmakuClock | null },
  mainInput = true,
) {
  const language = useI18n();
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const current = useRef({ model, action, danmaku, mainInput });
  current.current = { model, action, danmaku, mainInput };
  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    let active = true;
    const removers: (() => void)[] = [];
    const subscriptions: Promise<unknown>[] = [];
    const track = (subscription: Promise<() => void>) =>
      subscriptions.push(
        subscription
          .then((fn) => (active ? removers.push(fn) : fn()))
          .catch(() => {}),
      );
    const send = () => {
      if (current.current.model)
        void emitTo("player-ui", "player-ui-state", {
          ...presentationModel(current.current.model),
          language: getLanguage(),
        }).catch(() => {});
    };
    track(
      listen(
        "player-ui-ready",
        () => {
          if (active) {
            setReady(true);
            setGeneration((g) => g + 1);
            send();
          }
        },
        { target: "main" },
      ),
    );
    track(
      listen(
        "player-ui-focus",
        () => {
          if (active) void invoke("player_overlay_focus").catch(() => {});
        },
        { target: "main" },
      ),
    );
    track(
      listen<{ id: string; action: PlayerAction }>(
        "player-ui-action",
        async ({ payload }) => {
          if (!active) return;
          let error = "";
          try {
            await current.current.action(payload.action);
          } catch {
            error = t("player.the_action_could_not_be_completed_try");
          }
          // Never acknowledge an old request in a newly created control window.
          if (!active) return;
          void emitTo("player-ui", "player-ui-result", {
            id: payload.id,
            error,
          }).catch(() => {});
        },
        { target: "main" },
      ),
    );
    track(
      listen<{ key: string; code: string; shiftKey: boolean }>(
        "player-ui-key",
        ({ payload }) => {
          if (active)
            void emitTo("player-ui", "player-ui-key", payload).catch(() => {});
        },
        { target: "main" },
      ),
    );
    track(
      listen<string>(
        "player-controls",
        ({ payload }) => {
          if (active)
            void emitTo("player-ui", "player-controls", payload).catch(
              () => {},
            );
        },
        { target: "main" },
      ),
    );
    void Promise.all(subscriptions)
      .then(() =>
        active ? emitTo("player-ui", "player-ui-ping", {}) : undefined,
      )
      .catch(() => {});
    const keyboard = (event: KeyboardEvent) => {
      if (!current.current.mainInput) return;
      if (blockedShortcut(event)) return;
      if (
        !validKey(keyCode(event)) &&
        ![
          " ",
          "ArrowLeft",
          "ArrowRight",
          "Escape",
          "f",
          "F",
          "h",
          "H",
          "Tab",
        ].includes(event.key)
      )
        return;
      event.preventDefault();
      const payload = {
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      };
      const focus =
        event.key === "Tab"
          ? invoke("player_overlay_focus")
          : Promise.resolve();
      void focus
        .then(() =>
          active ? emitTo("player-ui", "player-ui-key", payload) : undefined,
        )
        .catch(() => {});
    };
    document.addEventListener("keydown", keyboard);
    const dismiss = () => {
      if (active)
        void emitTo("player-ui", "player-ui-dismiss", {}).catch(() => {});
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      active = false;
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("pointerdown", dismiss, true);
      removers.forEach((fn) => fn());
    };
  }, [enabled]);
  useEffect(() => {
    if (enabled && model)
      void emitTo("player-ui", "player-ui-state", {
        ...presentationModel(model),
        language,
      }).catch(() => {});
  }, [enabled, model, language]);
  useEffect(() => {
    if (enabled && ready && danmaku)
      void emitTo("player-ui", "player-danmaku-data", danmaku.document).catch(
        () => {},
      );
  }, [enabled, ready, generation, danmaku?.document]);
  useEffect(() => {
    if (enabled && ready && danmaku)
      void emitTo("player-ui", "player-danmaku-clock", danmaku.clock).catch(
        () => {},
      );
  }, [enabled, ready, generation, danmaku?.clock]);
  return ready;
}
