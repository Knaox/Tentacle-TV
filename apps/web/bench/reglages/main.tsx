/**
 * Le labo des réglages et de l'administration, SEUL : la page `/dev/reglages` rendue sans
 * l'application ni serveur, pour la capturer au Chrome sans tête (`capture.mjs`). Elle charge
 * la vraie feuille (`index.css`), les vrais écrans, et ce que `src/main.tsx` pose d'ordinaire
 * avant le premier rendu (langue, session). `?theme=light|dark`, `?vue=<id>`, `?bureau=linux`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { detectLanguage, initI18n } from "@tentacle-tv/shared";

import "../../src/index.css";
import { LAB_USER } from "../../src/dev/reglagesLab/fixtures/base";
import { ReglagesLab } from "../../src/dev/reglagesLab/ReglagesLab";
import { ThemeProvider } from "../../src/theme";
import { setMode } from "../../src/theme/colorScheme";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
if (theme === "light" || theme === "dark") setMode(theme);

initI18n({ lng: params.get("lang") ?? localStorage.getItem("tentacle_language") ?? detectLanguage() });
// La session du banc : son origine (`reglages.localhost`) n'appartient qu'à lui.
if (params.get("session") !== "none") localStorage.setItem("tentacle_user", JSON.stringify(LAB_USER));
else localStorage.removeItem("tentacle_user");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ReglagesLab strict />
    </ThemeProvider>
  </StrictMode>,
);
