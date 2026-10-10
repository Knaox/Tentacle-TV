import type { WhatsNewRelease } from "../types";
import { PipLaunchScene, PipScene, WatchedScene } from "../scenes/v1_28_0";

/**
 * 1.28.0 — la lecture en incrustation, puis un geste de l'accueil.
 *
 * Le PiP gagne macOS (puces Apple), Windows et Linux (KDE) : le texte le dit,
 * un Mac Intel ou un Linux sans KDE n'a pas le bouton. Deux scènes : réduire
 * (l'image gagne son coin, l'accueil reparaît), et lancer une autre lecture
 * qui s'y charge et s'y joue. Puis « Vu », qui se coche sous le curseur.
 * Pas de lien profond : le PiP vit dans le lecteur.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_28_0_<id>_title / _body).
 */
export const RELEASE_1_28_0: WhatsNewRelease = {
  version: "1.28.0",
  features: [
    { id: "pip", kind: "new", titleKey: "v1_28_0_pip_title", bodyKey: "v1_28_0_pip_body", Scene: PipScene },
    { id: "pipLaunch", kind: "new", titleKey: "v1_28_0_pipLaunch_title", bodyKey: "v1_28_0_pipLaunch_body", Scene: PipLaunchScene },
    { id: "watched", kind: "improved", titleKey: "v1_28_0_watched_title", bodyKey: "v1_28_0_watched_body", Scene: WatchedScene },
  ],
};
