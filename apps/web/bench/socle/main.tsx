/**
 * Le labo du socle, SEUL : la page `/dev/socle` rendue sans l'application ni serveur, pour la
 * capturer au Chrome sans tête (`capture.mjs`). Elle charge la vraie feuille (`index.css`) et
 * les vrais composants. `?theme=light|dark` choisit le thème, `?vue=…` une partie de la page.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../../src/index.css";
import { SocleLab } from "../../src/dev/socleLab/SocleLab";
import { ThemeProvider } from "../../src/theme";
import { setMode } from "../../src/theme/colorScheme";

const theme = new URLSearchParams(window.location.search).get("theme");
if (theme === "light" || theme === "dark") setMode(theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <SocleLab />
    </ThemeProvider>
  </StrictMode>,
);
