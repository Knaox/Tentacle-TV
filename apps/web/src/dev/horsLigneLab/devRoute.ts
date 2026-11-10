/**
 * La page du labo du hors ligne (`/dev/hors-ligne`), pour `App.tsx` : présente dans les paquets
 * de développement SEULEMENT (Vite en dev, `build:web:debug` du bureau). Ailleurs — paquets
 * livrés, client LG — la condition vaut faux à la construction : `null`, et le module disparaît.
 */

import { lazy } from "react";

export const DevHorsLigneLab =
  import.meta.env.DEV || __PLAYER_DEBUG__
    ? lazy(() => import("./HorsLigneLab").then((m) => ({ default: m.HorsLigneLab })))
    : null;
