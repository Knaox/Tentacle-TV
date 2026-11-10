/**
 * La page du labo des réglages et de l'administration (`/dev/reglages`), pour `App.tsx` :
 * présente dans les paquets de développement SEULEMENT (Vite en dev, `build:web:debug` du
 * bureau). Ailleurs — paquets livrés, client LG — la condition vaut faux à la construction :
 * `null`, et le module (ses données factices comprises) disparaît du paquet.
 */

import { lazy } from "react";

export const DevReglagesLab =
  import.meta.env.DEV || __PLAYER_DEBUG__
    ? lazy(() => import("./ReglagesLab").then((m) => ({ default: m.ReglagesLab })))
    : null;
