/**
 * Le labo d'Octave, SEUL : la page `/dev/octave` rendue sans l'application ni serveur, pour la
 * capturer au Chrome sans tête (`capture.mjs`). Elle charge la vraie feuille (`index.css`), les
 * vrais écrans d'Octave et les textes français. `?theme=light|dark` choisit le thème (celui de
 * Tentacle ET celui d'Octave, réglés à part), `?vue=…` la scène (`labScenes.ts`).
 *
 * Le compte est factice : le banc tourne sur une origine à lui (`octave.localhost`), son stockage
 * ne touche aucune vraie session.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initI18n } from "@tentacle-tv/shared";

import "../../src/index.css";
import { LAB_USER } from "../../src/dev/octaveLab/data/labPlaylists";
import { OctaveLab } from "../../src/dev/octaveLab/OctaveLab";
import { ThemeProvider } from "../../src/theme";
import { setMode } from "../../src/theme/colorScheme";
import { setOctaveTheme } from "../../src/theme/octaveAppearance";

// ⚠️ Clé de stockage de la session (`tentacle_user`) : jamais renommée.
localStorage.setItem("tentacle_user", JSON.stringify({ Id: LAB_USER.userId, Name: LAB_USER.name }));
// Le repère de la première visite (une bulle sous la bascule) paraîtrait au hasard des captures : déjà vu.
localStorage.setItem("tentacle_octave_intro_seen", "1");
initI18n({ lng: "fr" });

const theme = new URLSearchParams(window.location.search).get("theme");
if (theme === "light" || theme === "dark") {
  setMode(theme);
  setOctaveTheme(theme);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <OctaveLab />
    </ThemeProvider>
  </StrictMode>,
);
