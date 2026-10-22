/**
 * La page du labo du verre (`/dev/verre`), pour `App.tsx` : présente dans les
 * paquets de développement SEULEMENT (Vite en dev, `build:web:debug` du
 * bureau). Ailleurs — paquets livrés, client LG — la condition vaut faux à la
 * construction : `null`, et le module du labo disparaît du paquet.
 */

import { lazy } from "react";

export const DevGlassLab =
  import.meta.env.DEV || __PLAYER_DEBUG__
    ? lazy(() => import("./GlassLab").then((m) => ({ default: m.GlassLab })))
    : null;
