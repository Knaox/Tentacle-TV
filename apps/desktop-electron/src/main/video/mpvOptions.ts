/**
 * Les options posées sur mpv avant son initialisation — et surtout celles qui
 * l'empêchent de charger le moindre script.
 *
 * # Pourquoi c'est vital, et pas une optimisation
 *
 * ⚠️ mpv embarque **LuaJIT** pour ses scripts intégrés, et LuaJIT écrit du code
 * machine à l'exécution. Une signature durcie — celle du paquet Mac App Store —
 * interdit d'exécuter une page mémoire qu'elle n'a pas scellée : macOS ne
 * refuse pas l'opération, il TUE le processus. Mesuré sur le build 1355134, à la
 * première lecture :
 *
 *   signal SIGKILL (Code Signature Invalid) · termination CODESIGNING, Invalid Page
 *   fil du script `auto_profiles` : libmpv load_builtin → libluajit → run_script
 *
 * Le journal de mpv (`msg-level=all=v`) montre ce qu'il charge sans qu'on lui
 * demande rien : `ytdl_hook`, `stats`, `console`, `auto_profiles`, `select`,
 * `positioning`, `commands`. Avec les options ci-dessous, ce même journal ne
 * charge plus rien — vérifié ligne à ligne, sur la libmpv 0.40 LGPL du paquet.
 *
 * # Pourquoi on ne perd rien
 *
 * Aucun de ces scripts n'est sollicité ici : l'interface, l'affichage à l'écran
 * et la sélection de pistes sont les nôtres, et rien ne passe par ytdl. Couper
 * ces chargements évite aussi sept threads et sept lectures de fichier au
 * démarrage de chaque lecture, sur les trois systèmes.
 *
 * # Pourquoi pas un droit de signature à la place
 *
 * Parce qu'il faudrait `com.apple.security.cs.allow-unsigned-executable-memory` :
 * LuaJIT n'alloue pas sa mémoire exécutable par `MAP_JIT`, donc
 * `com.apple.security.cs.allow-jit` — que V8 exige, lui — ne le couvre pas.
 * Autrement dit, on échangerait sept scripts inutiles contre la levée d'une
 * protection sur tout le processus. Le prix est absurde.
 */

import { montageLinux } from "../linux/session";
import { socleLinux } from "../linux/optionsMpv";
import { mpvApi } from "./mpvFfi";

/**
 * Posées APRÈS les options de la page, pour qu'elles ne puissent pas les
 * rallumer. Une option qu'un libmpv plus ancien ne connaît pas est simplement
 * signalée dans son journal, jamais fatale.
 */
const SANS_SCRIPTS: Readonly<Record<string, string>> = {
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

/**
 * Pose les options de la page, puis le socle — dans cet ordre, pour que la page
 * ne puisse pas rallumer les scripts.
 *
 * Une option inconnue du libmpv embarqué n'est jamais fatale : mpv la signale
 * dans son journal et continue. On ne remonte donc aucune erreur.
 */
export function poserOptions(
  ctx: unknown,
  page: Readonly<Record<string, string | number | boolean>>,
): void {
  const api = mpvApi();
  const poser = (k: string, v: string): void => {
    const code = api.setOptionString(ctx, k, v);
    // Journal seulement — jamais fatal —, mais dire QUELLE option un libmpv
    // refuse a manqué à plus d'un diagnostic : jusqu'ici le refus était muet.
    if (typeof code === "number" && code < 0) {
      console.warn(`[mpv] option refusée (${code}) : ${k}=${v}`);
    }
  };
  for (const [k, v] of Object.entries(page)) {
    poser(k, typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  }
  for (const [k, v] of Object.entries(SANS_SCRIPTS)) poser(k, v);
  // Sous Linux, le contexte GPU, la transmission HDR et le plein écran dépendent
  // de la SESSION, que la page ne connaît pas. Voir `linux/optionsMpv.ts`.
  const montage = montageLinux();
  if (montage !== null) {
    for (const [k, v] of Object.entries(socleLinux(montage))) poser(k, v);
  }
}
