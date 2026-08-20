import { creerUseDecompteSautIntro } from "@tentacle-tv/tv-core";
import { useSautIntroAuto } from "../lib/sautIntroAuto";

/** Le décompte du saut d'intro, branché sur la préférence native. */
export const useSautIntroTv = creerUseDecompteSautIntro(useSautIntroAuto);
