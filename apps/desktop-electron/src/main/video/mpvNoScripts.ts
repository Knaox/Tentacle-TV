/**
 * Le socle « aucun script » de toute instance mpv — vidéo (`mpvOptions.ts`)
 * et musique (`audio/audioMpv.ts`). Le POURQUOI (LuaJIT tué par la signature
 * durcie du Mac App Store) est en tête de `mpvOptions.ts`.
 *
 * Extrait pour que l'instance audio le reprenne sans tirer les options de
 * session Linux de la vidéo : une seule liste, deux instances.
 */

/**
 * Posées APRÈS les options de la page, pour qu'elles ne puissent pas les
 * rallumer. Une option qu'un libmpv plus ancien ne connaît pas est simplement
 * signalée dans son journal, jamais fatale.
 */
export const NO_SCRIPTS: Readonly<Record<string, string>> = {
  /** Scripts du dossier de configuration de l'utilisateur. */
  "load-scripts": "no",
  /** Liste explicite, vidée : `--scripts=` ne laisse rien passer. */
  scripts: "",
  /** `auto_profiles.lua` — celui qui a tué le paquet 1355134. */
  "load-auto-profiles": "no",
  /** `console.lua` — la console de mpv, invisible ici. */
  "load-osd-console": "no",
  /** `stats.lua` — le panneau de statistiques de mpv (touche i). */
  "load-stats-overlay": "no",
  /** `select.lua` — les menus de sélection de mpv. */
  "load-select": "no",
  /** `positioning.lua` — le placement de fenêtre par mpv, que la coquille gère. */
  "load-positioning": "no",
  /** `commands.lua` — la palette de commandes de mpv. */
  "load-commands": "no",
  /** `ytdl_hook.lua` — aucune URL ne va vers youtube-dl. */
  ytdl: "no",
  /** `osc.lua` — déjà coupé par la page ; non négociable ici. */
  osc: "no",
};
