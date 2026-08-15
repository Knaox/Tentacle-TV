import type { AudioTrack } from "../../components/player/videoPlayer.types";

/**
 * Le lecteur publiera-t-il cette piste dans `video.audioTracks` ?
 *
 * La question n'a de réponse ferme que là où le démultiplexeur est connu. Un
 * navigateur ne l'est pas — son moteur change avec la version, et rien ne
 * l'annonce — donc il dit oui, et l'appariement se charge du reste : une piste
 * promise mais absente rend `null`, ce qui déclenche une session serveur.
 *
 * Le téléviseur, lui, a une table documentée conteneur par conteneur, et il
 * substitue ce module (cf. `config/tableSubstitutions.ts`). Y répondre non
 * évite une méprise que l'appariement ne pourrait pas rattraper seul : deux
 * pistes de la même langue dont une seule est ouvrable, où le rang libre
 * reviendrait à la mauvaise.
 */
export function pistePubliable(_piste: AudioTrack): boolean {
  return true;
}
