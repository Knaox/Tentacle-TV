/**
 * La page du labo du socle (`/dev/socle`), pour `App.tsx` : présente dans les paquets de
 * développement SEULEMENT (Vite en dev, `build:web:debug` du bureau). Ailleurs — paquets livrés,
 * client LG — la condition vaut faux à la construction : `null`, et le module disparaît du paquet.
 */

import { lazy } from "react";

export const DevSocleLab =
  import.meta.env.DEV || __PLAYER_DEBUG__
    ? lazy(() => import("./SocleLab").then((m) => ({ default: m.SocleLab })))
    : null;
