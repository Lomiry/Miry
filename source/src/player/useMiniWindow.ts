import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
export interface MiniPresentation {
  session: string;
  active: boolean;
  revision: number;
}

// Native presentation only; media and preferences remain session/store owned.
export function useMiniWindow(session?: string, native?: MiniPresentation) {
  const [display, setDisplay] = useState<string | null>(null);
  const current = useRef(session);
  current.current = session;
  const mounted = useRef(true);
  const latest = useRef(-1);
  const project = (payload: MiniPresentation) => {
    if (
      !mounted.current ||
      payload.session !== current.current ||
      !Number.isSafeInteger(payload.revision) ||
      payload.revision <= latest.current
    )
      return;
    latest.current = payload.revision;
    setDisplay(payload.active ? payload.session : null);
  };
  const projector = useRef(project);
  projector.current = project;
  useEffect(() => {
    if (native) projector.current(native);
  }, [native]);
  useEffect(() => {
    mounted.current = true;
    if (!isTauri()) return;
    let remove: (() => void) | undefined;
    let active = true;
    void listen<MiniPresentation>("player-mini-changed", ({ payload }) => {
      if (active) projector.current(payload);
    })
      .then((fn) => (active ? (remove = fn) : fn()))
      .catch(() => {});
    return () => {
      active = false;
      mounted.current = false;
      remove?.();
    };
  }, []);
  const mini =
    native && native.session === session && native.revision >= latest.current
      ? native.active
      : !!display && display === session;
  return {
    active: mini,
    async action(
      command: "enter" | "leave" | "pin" | "drag",
      expectedSession: string,
    ) {
      if (!expectedSession || expectedSession !== current.current) return;
      const result = await invoke<MiniPresentation>("player_mini", {
        command,
        playSessionId: expectedSession,
      });
      if (!mounted.current || current.current !== expectedSession) return;
      projector.current(result);
    },
  };
}
