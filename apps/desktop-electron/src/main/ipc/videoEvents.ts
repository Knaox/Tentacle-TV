/**
 * Ce que la couche vidéo fait de chaque évènement de mpv.
 *
 * Extrait de `ipc/video.ts` pour tenir la limite de 300 lignes, et parce que
 * décider quoi faire d'un évènement est un métier distinct d'exposer des
 * commandes à la page.
 */

import { sendToPage } from "../pageEvents";
import { trace } from "../video/native";
import { grant } from "../video/hdrSession";
import type { MpvEventPayload, PropertyChange } from "../video/mpv";
import { markStartup, sinceStartupMs, type StartupMilestone } from "../video/startupClock";
import type { VideoSurface } from "../video/surface";
import { scheduleReport } from "./videoProbe";

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

/** Les jalons de mpv que l'horloge du démarrage date (`startupClock.ts`). */
const MILESTONES: ReadonlySet<string> = new Set<StartupMilestone>([
  "start-file",
  "file-loaded",
  "video-reconfig",
  "playback-restart",
]);

function isMilestone(event: string): event is StartupMilestone {
  return MILESTONES.has(event);
}

/**
 * Le décalage depuis `mpv_init`, glissé dans la charge utile : la chronologie
 * de la page part au `loadfile` et ne voit pas ce que la coquille paie avant.
 * Absent hors démarrage — la page traite déjà les champs qu'elle ne connaît pas.
 */
function stamped(p: MpvEventPayload): MpvEventPayload {
  const since = sinceStartupMs();
  return since === null ? p : { ...p, sinceInitMs: since };
}

/** Le relais d'évènements, pour la surface courante. */
export function eventRelay(surface: () => VideoSurface | null): {
  event: (p: MpvEventPayload) => void;
  property: (p: PropertyChange) => void;
} {
  return {
    event: (p) => {
      // L'horloge date les quatre jalons de mpv ; à la première image elle rend
      // sa ligne, écrite dans TOUS les builds — c'est elle qu'un ticket cite.
      if (isMilestone(p.event)) {
        const line = markStartup(p.event);
        if (line !== null) console.info(line);
      }
      // Le contenu ne se déclare qu'une fois le fichier ouvert : c'est le seul
      // moment où l'on sait s'il faut basculer l'écran. Comme tous les bons
      // lecteurs, on le fait UNE fois au démarrage — changer le mode d'un écran
      // coûte une à deux secondes de noir. `file-loaded` d'abord, au cas où les
      // paramètres seraient déjà là, puis `video-reconfig`, où ils le sont à
      // coup sûr.
      if (p.event === "file-loaded" || p.event === "video-reconfig") grant();
      // La fenêtre de mpv naît à l'ouverture du fichier, et le compositeur
      // peut la mettre devant la nôtre. La surface qui doit redemander
      // l'activation l'apprend ici (Wayland seulement, voir `surfaceWayland.ts`).
      if (p.event === "file-loaded") surface()?.fileLoaded?.();
      // Et la sortie vidéo configurée est l'instant où une fenêtre mpv se
      // MESURE — la surface collée vérifie là qu'elle suit bien la nôtre.
      if (p.event === "video-reconfig") surface()?.videoReconfigured?.();
      if (TRACES.has(p.event)) {
        const reason = p.event === "end-file" ? ` (raison ${String(p["reason"])})` : "";
        // `trace` et non `console.info` : ces lignes servent à diagnostiquer une
        // lecture qui ne démarre pas, ce qui se fait en développement. Un paquet
        // livré n'a personne pour les lire.
        trace(`mpv → ${p.event}${reason}`);
      }
      // La lecture a vraiment commencé : c'est le moment de regarder ce que
      // l'écran montre, plutôt que ce que mpv en dit. Sans effet hors
      // développement, et une seule fois par lecture.
      if (p.event === "playback-restart") scheduleReport(surface);
      sendToPage("mpv://event", stamped(p));
    },
    property: (p) => sendToPage("mpv://property-change", p),
  };
}
