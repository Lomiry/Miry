import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import WindowFrame from "./components/WindowFrame";
import PlayerOverlayWindow from "./components/PlayerOverlayWindow";
import TooltipHost from "./components/TooltipHost";
import { initializeAppearance } from "./stores/appearance";
import "./style.css";
import "./player.css";
import "./features.css";
import "./motion.css";
import "./window.css";
import "./controls.css";
import "./discovery.css";
import "./design/tokens.css";
import "./design/components.css";
import "./design/layout.css";
import "./design/list.css";
import "./design/player.css";
import "./design/polish.css";
import "./design/desktop.css";
const playerUi =
  (window as unknown as { __MIRY_PLAYER_UI__?: boolean }).__MIRY_PLAYER_UI__ ===
  true;
if (playerUi) document.documentElement.classList.add("player-ui-document");
initializeAppearance();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipHost />
    {playerUi ? (
      <PlayerOverlayWindow />
    ) : (
      <WindowFrame>
        <App />
      </WindowFrame>
    )}
  </React.StrictMode>,
);
