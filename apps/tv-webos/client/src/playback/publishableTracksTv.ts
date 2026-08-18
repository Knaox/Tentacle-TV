import type { AudioTrack } from "@/components/player/videoPlayer.types";
import { CODECS_JAMAIS_DEMULTIPLEXES } from "./capabilitiesWebos";

/**
 * Ce que le démultiplexeur de la dalle ouvrira, et ce qu'il passera sous
 * silence.
 *
 * Substitué à `lib/deviceProfile/pistesLecteur.ts`. La liste est **absolue** :
 * elle ne porte que ce qu'AUCUNE génération de webOS ne démultiplexe, dans
 * aucun conteneur. Tout ce qui dépend de l'année, du modèle ou du conteneur —
 * le DTS au premier chef — n'a rien à faire ici : c'est un « peut-être », et un
 * peut-être se tranche à l'exécution par l'appariement, qui voit la liste que
 * le lecteur a réellement publiée.
 *
 * Autrement dit : ce module ne remplace pas la mesure, il ne lève que
 * l'ambiguïté que la mesure ne peut pas lever seule.
 */
export function pistePubliable(piste: AudioTrack): boolean {
  const codec = piste.codec?.toLowerCase();
  if (!codec) return true;
  return !CODECS_JAMAIS_DEMULTIPLEXES.has(codec);
}
