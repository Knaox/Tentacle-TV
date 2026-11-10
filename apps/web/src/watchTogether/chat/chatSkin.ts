/**
 * La peau du chat de Watch Together (refonte de nov. 2026).
 *
 * Le chat flotte au-dessus de la VIDÉO (ou de n'importe quelle page pendant une séance) : il
 * reste sombre dans les deux thèmes, comme les capsules du lecteur — ses couleurs sont donc en
 * dur, pas des jetons (`--accent` vaut un fuchsia profond en thème clair, illisible sur l'encre).
 *
 * Ce que cette peau s'interdit : le `backdrop-filter` (posé sur la vidéo, il se recalcule à
 * chaque image décodée ; sur le bureau il ne floute rien, mpv dessine sous la page), le liseré
 * et la lueur de marque, et toute animation infinie (le point de message non lu ne bat plus).
 */

import type { CSSProperties } from "react";
import { videoShadow } from "../../lib/videoShadow";

/** L'encre du panneau : opaque. L'ombre large sort en aplat sur la surface à alpha (`videoShadow`). */
export const CHAT_INK: CSSProperties = {
  background: "#131315",
  boxShadow: videoShadow(
    "0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 50px -14px rgba(0, 0, 0, 0.85)",
    "0 0 0 1px rgba(255, 255, 255, 0.12)",
  ),
};

/** La bulle repliée et les avis de message : l'encre des capsules du lecteur. */
export const CHAT_CAPSULE: CSSProperties = { background: "#18181B", boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08)" };

/** La teinte franche, en dur (sombre) : le nom de qui parle, ce qui est actif. */
export const CHAT_ACCENT = "#E58CF0";

/** Un bouton rond du chat (fermer, emojis) : la pression répond, le survol éclaire — rien ne grossit. */
export const CHAT_ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-white/70 outline-none transition-[background-color,color,transform] duration-hover hover:bg-white/10 hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70";

/** Le même, ALLUMÉ (onglet ouvert). */
export const CHAT_ICON_BUTTON_ON = "bg-white/[0.16] !text-white";

/** Un champ du chat : une pilule d'encre claire, anneau de focus à la teinte franche. */
export const CHAT_FIELD =
  "min-w-0 flex-1 rounded-pill bg-white/[0.09] px-4 text-sm text-white placeholder-white/50 outline-none transition-shadow duration-hover focus:shadow-[inset_0_0_0_1.5px_#E58CF0]";
