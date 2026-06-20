import { Platform } from "react-native";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";

/**
 * Codecs de sous-titres à INCRUSTER dans la vidéo (burn-in → transcodage) sur la
 * plateforme courante.
 *
 * - Graphiques (PGS / VOBSUB / DVBSUB) : toujours, partout (non rendables en texte).
 * - **TOUT sous-titre texte sur tvOS** : AVPlayer rend mal le texte stylé —
 *   l'ASS n'est pas géré (VTT converti illisible), ET les SRT/VTT contenant des
 *   balises override en dur ({\an8}, signs, SDH issus d'ASS) les affichent
 *   LITTÉRALEMENT (la conversion serveur ne les strippe pas). Le burn-in passe par
 *   ffmpeg/libass, qui INTERPRÈTE ces balises (positionnement) au lieu de les
 *   afficher → rendu propre et fidèle. Coût : transcodage quand un sous-titre est
 *   actif. Sur Android (ExoPlayer/MPV), le texte est rendu nativement (pas de
 *   burn-in pour le texte ; seuls les graphiques sont incrustés).
 */
export function isBurnInSubtitleCodec(codec?: string): boolean {
  if (BURN_IN_SUBTITLE_CODECS.test(codec ?? "")) return true;
  // tvOS : incruster tout sous-titre (texte inclus) — cf. ci-dessus.
  if (Platform.OS === "ios" && (codec ?? "").length > 0) return true;
  return false;
}
