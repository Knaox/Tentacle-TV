/**
 * L'état HDR de l'affichage, exposé à la page.
 *
 * Sorti de `ipc/video.ts` (même geste que `ipc/videoSonde.ts`) pour deux
 * raisons : tenir la limite de 300 lignes, et surtout parce que ces commandes
 * sont déclarées SANS CONDITION — même quand aucune libmpv n'est chargeable et
 * que les commandes `mpv_*` se taisent, le panneau de diagnostic et la
 * politique d'écran doivent pouvoir répondre.
 */

import { z } from "zod";
import {
  basculeEnCours,
  edrCapable,
  espaceRendu,
  hdrActif,
  hdrSupporte,
  renduEnHdr,
} from "../video/displayHdr";
import { autoriserBascule, basculeAutorisee } from "../video/hdrSession";
import type { VideoSurface } from "../video/surface";
import type { CommandRegistry } from "./registry";

const SURFACE = z.object({ on: z.boolean() });
const NO_ARGS = z.object({}).passthrough();

export function registerDisplayHdrCommands(
  registry: CommandRegistry,
  surface: () => VideoSurface | null,
): void {
  registry
    .add("display_hdr_state", {
      schema: NO_ARGS,
      run: () => {
        // La fenêtre vidéo désigne l'écran à interroger sur macOS. Absente
        // ailleurs, et absente aussi hors lecture — la sonde retombe alors sur
        // l'écran principal, ce qui reste la bonne réponse.
        const fenetre = surface()?.fenetreVideo?.();
        return {
          supporte: hdrSupporte(),
          actif: hdrActif(fenetre),
          bascule: basculeEnCours(),
          autoAutorise: basculeAutorisee(),
          // Diagnostic seul : dit que l'écran SAIT faire de la plage étendue,
          // sans rien promettre d'une bascule qui n'existe pas sur macOS.
          edrCapable: edrCapable(fenetre),
          // ⚠️ À NE PAS confondre avec `actif`. Celui-ci est instantané et
          // dépend de l'IMAGE affichée : une scène de nuit ne réclame aucune
          // haute lumière et retombe à 1,00 sur une lecture parfaitement HDR
          // (mesuré, même film : 1,00 puis 12,82). `coucheHdr` dit ce que mpv
          // rapporte de sa couche Metal, ce qui ne dépend pas de la scène.
          // `null` = mpv n'a rien dit, et surtout pas « non ».
          coucheHdr: renduEnHdr(),
          espaceCouche: espaceRendu(),
        };
      },
    })
    .add("display_hdr_auto", {
      schema: SURFACE,
      run: ({ on }) => autoriserBascule(on),
    });
}
