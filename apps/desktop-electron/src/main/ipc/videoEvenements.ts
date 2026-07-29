/**
 * Ce que la couche vidéo fait de chaque évènement de mpv.
 *
 * Extrait de `ipc/video.ts` pour tenir la limite de 300 lignes, et parce que
 * décider quoi faire d'un évènement est un métier distinct d'exposer des
 * commandes à la page.
 */

import { sendToPage } from "../pageEvents";
import { accorder } from "../video/hdrSession";
import type { MpvEventPayload, PropertyChange } from "../video/mpv";
import type { VideoSurface } from "../video/surface";
import { planifierRapport } from "./videoSonde";

/**
 * Évènements dignes du journal.
 *
 * Un écran de chargement infini veut dire que `file-loaded` n'arrive jamais ;
 * ces quatre-là disent où la chaîne s'arrête — ouverture du fichier,
 * configuration de la sortie vidéo, première image, fin.
 */
const TRACES: ReadonlySet<string> = new Set([
  "start-file",
  "file-loaded",
  "video-reconfig",
  "end-file",
]);

/** Le relais d'évènements, pour la surface courante. */
export function relaisEvenements(surface: () => VideoSurface | null): {
  event: (p: MpvEventPayload) => void;
  property: (p: PropertyChange) => void;
} {
  return {
    event: (p) => {
      // Le contenu ne se déclare qu'une fois le fichier ouvert : c'est le seul
      // moment où l'on sait s'il faut basculer l'écran. Comme tous les bons
      // lecteurs, on le fait UNE fois au démarrage — changer le mode d'un écran
      // coûte une à deux secondes de noir. `file-loaded` d'abord, au cas où les
      // paramètres seraient déjà là, puis `video-reconfig`, où ils le sont à
      // coup sûr.
      if (p.event === "file-loaded" || p.event === "video-reconfig") accorder();
      if (TRACES.has(p.event)) {
        const raison = p.event === "end-file" ? ` (raison ${String(p["reason"])})` : "";
        console.info(`[video] mpv → ${p.event}${raison}`);
      }
      // La lecture a vraiment commencé : c'est le moment de regarder ce que
      // l'écran montre, plutôt que ce que mpv en dit. Sans effet hors
      // développement, et une seule fois par lecture.
      if (p.event === "playback-restart") planifierRapport(surface);
      sendToPage("mpv://event", p);
    },
    property: (p) => sendToPage("mpv://property-change", p),
  };
}
