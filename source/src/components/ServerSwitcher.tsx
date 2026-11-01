import { useId, useRef, useState } from "react";
import { ChevronDown, LogOut, Network, Plus, Server } from "lucide-react";
import type { Account } from "../types/emby";
import {
  connectionId,
  connectionLabel,
  type Connection,
} from "../stores/connections";
import { t } from "../i18n/core";
import Popover from "./Popover";
import MenuItem from "./MenuItem";
import ServerIcon from "./ServerIcon";

export default function ServerSwitcher({
  account,
  connections,
  busy,
  demo,
  onSwitch,
  onAdd,
  onEdit,
  onLogout,
}: {
  account: Account | null;
  connections: Connection[];
  busy: boolean;
  demo: boolean;
  onSwitch: (connection: Connection) => void;
  onAdd: () => void;
  onEdit: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null),
    id = useId();
  const close = (restore = true) => {
    setOpen(false);
    if (restore) anchor.current?.focus({ preventScroll: true });
  };
  return (
    <div className="server-switcher">
      <button
        ref={anchor}
        className="server-menu-trigger"
        aria-label={t("library.current_server")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        title={account ? connectionLabel(account) : t("library.demo_mode")}
        disabled={busy}
        onClick={() => setOpen(!open)}
      >
        {account ? (
          <ServerIcon account={account} />
        ) : (
          <Server className="server-icon" size={24} aria-hidden="true" />
        )}
        <span>
          {account ? connectionLabel(account) : t("library.demo_mode")}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <button
        className="server-add"
        aria-label={t("library.add_server")}
        title={t("library.add_server")}
        disabled={busy}
        onClick={onAdd}
      >
        <Plus size={18} />
      </button>
      <Popover
        id={id}
        open={open}
        anchor={anchor}
        onClose={close}
        label={t("library.current_server") + t("library.options")}
        width={280}
      >
        {account && (
          <div className="server-menu-info">
            <strong>{connectionLabel(account)}</strong>
            <small className="connection-address">{account.server}</small>
          </div>
        )}
        {connections.map((c, index) => (
          <MenuItem
            key={connectionId(c.account)}
            role="menuitemradio"
            data-value={index}
            aria-checked={
              !!account && connectionId(c.account) === connectionId(account)
            }
            selected={
              !!account && connectionId(c.account) === connectionId(account)
            }
            disabled={busy || demo}
            onClick={() => {
              close();
              onSwitch(c);
            }}
          >
            {connectionLabel(c.account)}
          </MenuItem>
        ))}
        <MenuItem
          role="menuitem"
          disabled={busy}
          icon={<Plus size={18} />}
          onClick={() => {
            close();
            onAdd();
          }}
        >
          {t("library.add_server")}
        </MenuItem>
        {account && (
          <MenuItem
            role="menuitem"
            disabled={busy}
            icon={<Network size={18} />}
            onClick={() => {
              close();
              onEdit();
            }}
          >
            {t("routeC.edit")}
          </MenuItem>
        )}
        <MenuItem
          role="menuitem"
          disabled={busy}
          danger
          icon={<LogOut size={18} />}
          onClick={() => {
            close();
            if (demo || window.confirm(t("routeUi.logout_confirm"))) onLogout();
          }}
        >
          {t("library.sign_out")}
        </MenuItem>
      </Popover>
    </div>
  );
}
