/**
 * Lire et écrire une propriété de mpv — et surtout, sur quel thread on ne le
 * fait PAS. Les deux fonctions vivaient dans `mpv.ts`, qui a dépassé les 300
 * lignes ; la poignée leur est passée, elles ne la tiennent pas.
 */

import koffi from "koffi";
import { mpvApi, mpvError } from "./mpvFfi";
import { readAsync } from "./mpvRead";
import { sendCommand } from "./mpvCommand";

/**
 * Lit une propriété sous forme de chaîne. `null` si absente.
 *
 * # Sur macOS, on DEMANDE — mais on n'attend pas
 *
 * ⚠️ `mpv_get_property_string` est synchrone et prend le verrou du cœur de mpv.
 * Pour une propriété qui dépend de la sortie vidéo — `video-params/*`,
 * `video-target-params/*`, tout ce que le panneau de diagnostic affiche — mpv
 * doit toucher sa NSWindow, donc passer par le thread principal. Appelée DEPUIS
 * ce thread, la lecture attend un thread qui l'attend : l'application se fige,
 * sans un pourcent de processeur ni un message d'erreur.
 *
 * Le piège est qu'il ne se referme pas tout de suite : tout fonctionne pendant
 * plusieurs minutes, et l'application meurt au générique — au moment où mpv
 * reconfigure sa sortie pendant qu'on l'interroge. C'est le défaut le plus cher
 * de la phase 1, rencontré deux fois.
 *
 * `mpv_get_property_async` répond par la file d'évènements, qu'on vide déjà :
 * on peut donc tout lire sans rien attendre. Voir `mpvRead.ts`, qui garde le
 * souvenir des propriétés observées en REPLI quand mpv ne répond pas.
 *
 * # Sous Linux, on ne bloque pas non plus — pas un interblocage, un gel
 *
 * La fenêtre de mpv n'y dépend pas de notre thread, donc rien ne se fige pour
 * de bon. Mais `mp_dispatch_lock` attend que le cœur de mpv serve sa file, et
 * il ne la sert pas pendant qu'il monte ou démonte sa chaîne vidéo — contexte
 * Vulkan, CUDA. Mesuré le 17.09.2026, battement à 50 ms : la lecture synchrone
 * posée sur `video-reconfig` retenait le thread principal 216 ms au démontage
 * d'un épisode, puis 81 et 84 ms ; pendant ce temps ni la pompe d'évènements,
 * ni l'IPC, ni la page n'avançaient — au pire moment, celui de la première
 * image et du changement d'épisode. Même remède que macOS : on demande, on
 * n'attend pas. Windows garde l'appel direct, qui n'y a jamais coûté.
 */
export function readProperty(ctx: unknown, name: string): Promise<string | null> {
  if (!ctx) return Promise.resolve(null);
  if (process.platform !== "win32") return readAsync(ctx, name);
  const ptr = mpvApi().getPropertyString(ctx, name) as unknown;
  if (!ptr) return Promise.resolve(null);
  const value = koffi.decode(ptr, "char", -1) as string;
  mpvApi().free(ptr);
  return Promise.resolve(value);
}

/**
 * Écrit une propriété. Rend le motif de l'échec, ou `null`.
 *
 * # Sur macOS, on n'écrit pas non plus depuis ce thread
 *
 * ⚠️ `mpv_set_property_string` est le JUMEAU de la lecture ci-dessus, et il a
 * coûté exactement aussi cher : elle prend `mp_dispatch_lock`, donc attend le
 * cœur de mpv — lequel attend le thread principal pour créer sa `NSWindow`.
 * Chacun attend l'autre, à zéro pourcent de processeur et sans une erreur.
 *
 * Le défaut se déclenchait à COUP SÛR, et avant même la première image : la page
 * restaure le volume dès que le lecteur est prêt (`useMpvLifecycle`), puis pose
 * `pause=false` en tête de `play()` — les deux partent avant `loadfile`. D'où le
 * symptôme constaté pendant toute la phase 2 : chargement perpétuel, aucun
 * évènement mpv, aucun rapport de plantage. Pile du thread principal relevée au
 * `sample`, sans ambiguïté possible :
 *
 *   com.apple.main-thread → mpv_set_property_string → mpv_set_property
 *                         → mp_dispatch_lock → _pthread_cond_wait
 *
 * `set` par la file de commandes fait rigoureusement la même chose — c'est la
 * porte que `mpv_set_property_string` emprunte elle-même — mais sans attendre.
 *
 * Windows garde l'appel direct : sa fenêtre vidéo est une fenêtre enfant Win32
 * sans couplage au thread principal, et rien n'y a jamais bloqué.
 *
 * Linux passe par la même file depuis le 17.09.2026, pour la raison dite à
 * `getProperty` : la jumelle en écriture prend le même verrou.
 */
export function writeProperty(ctx: unknown, name: string, value: string): Promise<string | null> {
  if (!ctx) return Promise.resolve("mpv n'est pas demarre");
  if (process.platform === "win32") {
    return Promise.resolve(mpvError(mpvApi().setPropertyString(ctx, name, value) as number));
  }
  return sendCommand(ctx, ["set", name, value]);
}

