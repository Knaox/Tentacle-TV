import type { AdminSessionDto } from "../types/adminSessionsDto";

/**
 * Comment le média arrive à l'appareil — rangé du plus léger au plus lourd
 * pour le SERVEUR, la seule échelle qui compte pour un administrateur :
 *
 * - `direct` : le fichier part tel quel, le serveur ne calcule rien ;
 * - `remux` : image et son COPIÉS, seul le conteneur est réécrit — presque
 *   gratuit, et sans aucune perte ;
 * - `audio` : l'image est copiée, le son est converti — peu coûteux, mais le
 *   son perd sa piste d'origine (un TrueHD Atmos devient de l'AAC) ;
 * - `video` : l'image est réencodée — le vrai transcodage, le plus lourd ;
 * - `pending` : Jellyfin dit convertir (« Transcode ») sans encore décrire quoi
 *   — ni le premier encodage n'a été vu pour ce titre, ni il n'est retenu.
 *   Ce n'est PAS un transcodage vidéo prouvé : la pastille reste neutre et
 *   se précise dès que Jellyfin le décrit.
 *
 * Le `PlayMethod` déclaré ne suffit pas à le dire : un client qui passe par
 * une URL de transcodage se déclare « Transcode » même quand ffmpeg ne fait
 * que recopier les flux dans un autre conteneur — le web le fait pour tout
 * MKV, en HLS. Un remux s'affichait donc en « Transcodage », en jaune. Ce
 * sont les drapeaux du transcodage en cours (`IsVideoDirect`,
 * `IsAudioDirect`) qui disent ce que le serveur fait réellement : la règle
 * du tableau de bord de Jellyfin lui-même.
 */
export type DeliveryKind = "direct" | "remux" | "audio" | "video" | "pending";

/** Du plus léger au plus lourd : l'ordre des compteurs de l'en-tête. */
export const DELIVERY_ORDER: readonly DeliveryKind[] = ["direct", "remux", "audio", "video", "pending"];

const AUDIO_ONLY_TYPES: ReadonlySet<string> = new Set(["Audio", "AudioBook"]);

/**
 * La lecture a-t-elle une image ? Un morceau de musique n'en a pas, et
 * Jellyfin y déclare `IsVideoDirect` à faux — faute de flux vidéo à copier.
 * Sans cette garde, convertir un FLAC passerait pour le transcodage le plus
 * lourd.
 */
function hasVideo(session: Pick<AdminSessionDto, "nowPlaying" | "source">): boolean {
  if (session.source?.videoCodec !== undefined) return true;
  return !AUDIO_ONLY_TYPES.has(session.nowPlaying?.type ?? "");
}

export function deliveryOf(
  session: Pick<AdminSessionDto, "playMethod" | "transcoding" | "nowPlaying" | "source">,
): DeliveryKind {
  const video = hasVideo(session);
  const { transcoding } = session;
  if (transcoding !== null) {
    if (video && !transcoding.isVideoDirect) return "video";
    return transcoding.isAudioDirect ? "remux" : "audio";
  }
  // Aucun travail décrit : « DirectStream » sert alors le fichier tel quel
  // (flux statique). Un « Transcode » sans description n'est plus pris au
  // pire : Jellyfin ne le garde que si un encodage vit pour ce PlaySessionId
  // (mesuré sur 10.11.11 : sans encodage, il le réécrit « DirectPlay »), mais
  // cet encodage peut n'être qu'un remux ou un son converti. Le backend
  // retient le dernier vu pour ce titre (`transcodeMemory.ts`) et préfère ce
  // que le client Tentacle déclare (`snapshot.ts`) ; s'il ne sait rien —
  // l'épisode suivant à ses premières secondes —, la pastille dit « en
  // analyse » au lieu d'un « Transcodage » qu'elle ne peut pas prouver.
  // Sans image (musique), il ne reste que le son à convertir.
  if (session.playMethod === "Transcode") return video ? "pending" : "audio";
  return "direct";
}

/** Combien de lectures de chaque sorte : l'en-tête du tableau de bord. */
export function countDeliveries(sessions: readonly AdminSessionDto[]): Record<DeliveryKind, number> {
  const counts: Record<DeliveryKind, number> = { direct: 0, remux: 0, audio: 0, video: 0, pending: 0 };
  for (const session of sessions) {
    if (session.nowPlaying !== null) counts[deliveryOf(session)]++;
  }
  return counts;
}
