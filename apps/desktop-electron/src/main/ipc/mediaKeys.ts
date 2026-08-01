/**
 * Touches média du clavier.
 *
 * # Ce qu'on remplace, et ce qu'on ne remplace pas
 *
 * Côté Tauri, `smtc.rs` enregistre une vraie session SMTC WinRT : touches
 * média, MAIS AUSSI la vignette « lecture en cours » de Windows et les cibles
 * type Stream Deck. Electron n'a pas d'équivalent, et refaire SMTC demande des
 * appels de vtable COM.
 *
 * On livre donc l'usage principal — les touches — par `globalShortcut`, et les
 * trois autres commandes du contrat sont enregistrées SANS EFFET. Les
 * enregistrer plutôt que les omettre est délibéré : le contrat de la page est
 * partagé avec l'app Tauri, et une commande absente ferait rejeter chaque appel
 * en remplissant la console d'erreurs qui masqueraient les vraies. Le mixeur
 * Windows affiche déjà « Tentacle TV » de toute façon — mpv y nomme sa propre
 * session par `audio-client-name`.
 *
 * # Pourquoi le désenregistrement n'est pas un détail
 *
 * `globalShortcut` capte la touche pour TOUT LE SYSTÈME tant qu'il est posé.
 * Sans libération à la sortie du lecteur, Tentacle volerait la touche
 * « lecture » à Spotify en arrière-plan. Le cycle de vie de `useSmtc` — init au
 * montage, clear au démontage — donne exactement la bonne fenêtre.
 */

import { globalShortcut } from "electron";
import { z } from "zod";
import { sendToPage } from "../pageEvents";
import { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();
const PLAYBACK = z.object({ status: z.string() }).passthrough();
const METADATA = z.object({}).passthrough();

/**
 * Accélérateur → nom de bouton attendu par la page (`smtc-button`).
 *
 * `MediaPlayPause` devient `toggle` et non `play` : la touche bascule, elle ne
 * connaît pas l'état courant. C'est déjà ce que le relais Tauri envoie.
 */
const TOUCHES: ReadonlyArray<readonly [string, string]> = [
  ["MediaPlayPause", "toggle"],
  ["MediaStop", "stop"],
  ["MediaNextTrack", "next"],
  ["MediaPreviousTrack", "previous"],
];

let posees = false;

function poser(): void {
  if (posees) return;
  posees = true;
  const refusees: string[] = [];
  for (const [accelerateur, bouton] of TOUCHES) {
    // `register` rend `false` quand une autre application tient déjà la touche.
    // Tracé : sans ça, « la touche ne fait rien » n'a aucune explication.
    if (!globalShortcut.register(accelerateur, () => sendToPage("smtc-button", bouton))) {
      refusees.push(accelerateur);
    }
  }
  if (refusees.length > 0) {
    console.warn(`[touches media] refusees par le systeme : ${refusees.join(", ")}`);
  }
}

/** Rend les touches au système. Idempotent. */
export function releaseMediaKeys(): void {
  if (!posees) return;
  posees = false;
  for (const [accelerateur] of TOUCHES) globalShortcut.unregister(accelerateur);
}

export function registerMediaKeyCommands(registry: CommandRegistry): void {
  registry
    .add("smtc_init", { schema: NO_ARGS, run: () => poser() })
    .add("smtc_clear", { schema: NO_ARGS, run: () => releaseMediaKeys() })
    // Les trois suivantes n'ont pas d'équivalent sans session SMTC. Voir
    // l'en-tête : présentes pour que la page n'ait rien à savoir de la coquille.
    .add("smtc_set_playback", { schema: PLAYBACK, run: () => undefined })
    .add("smtc_set_metadata", { schema: METADATA, run: () => undefined })
    .add("set_audio_session_name", { schema: METADATA, run: () => undefined });
}
