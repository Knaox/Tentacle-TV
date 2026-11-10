/**
 * La page du labo des fiches (`/dev/fiches/*`), pour `App.tsx` : présente dans les paquets de
 * développement SEULEMENT (Vite en dev, `build:web:debug` du bureau). Ailleurs — paquets livrés,
 * client LG — la condition vaut faux à la construction : `null`, et le module (ses données
 * factices, ses images) disparaît du paquet.
 */

import { lazy } from "react";

export const DevFichesLab =
  import.meta.env.DEV || __PLAYER_DEBUG__
    ? lazy(() => import("./FichesLab").then((m) => ({ default: m.FichesLab })))
    : null;
