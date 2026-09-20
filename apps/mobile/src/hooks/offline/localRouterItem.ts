/**
 * Ce que le routeur de moteur doit juger pour une lecture LOCALE : le FICHIER
 * gardé, pas la source serveur. Un original est le fichier de Jellyfin, tel
 * quel. Une variante recompressée (`light`, remux `pmax` compris) est un MP4
 * AAC à une seule piste audio, tous les sous-titres en side-cars ; sa vidéo est
 * déclarée H.264 8 bits — le remux garde en vrai le codec d'origine, mais dans
 * un MP4 la décision du routeur est la même. Sans cela, un MKV recompressé en
 * MP4 partait au lecteur avancé pour un conteneur qu'il n'a plus.
 */

import type { MediaItem, MediaStream } from "@tentacle-tv/shared";

export interface LocalRouterSource {
  variant: "original" | "light";
  audioStreamIndex: number | null;
}

export function localRouterItem(item: MediaItem, source: LocalRouterSource): MediaItem {
  if (source.variant === "original") return item;
  const mediaSource = item.MediaSources?.[0];
  if (!mediaSource) return item;
  const streams = mediaSource.MediaStreams ?? [];
  const audios = streams.filter((s) => s.Type === "Audio");
  const keptAudio = audios.find((s) => s.Index === source.audioStreamIndex) ?? audios.find((s) => s.IsDefault) ?? audios[0];
  const kept: MediaStream[] = streams.flatMap((s) => {
    if (s.Type === "Video") {
      return [{ ...s, Codec: "h264", BitDepth: 8, DvProfile: undefined, VideoRangeType: "SDR", IsInterlaced: false }];
    }
    // Le serveur ne sort qu'une piste audio, toujours en AAC.
    if (s.Type === "Audio") return s === keptAudio ? [{ ...s, Codec: "aac" }] : [];
    // Les sous-titres texte sont des side-cars VTT ; les images ne sont pas emportées.
    if (s.Type === "Subtitle") return [{ ...s, Codec: "vtt", IsExternal: true }];
    return [s];
  });
  return { ...item, MediaSources: [{ ...mediaSource, Container: "mp4", MediaStreams: kept }] };
}
