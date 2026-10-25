import { Film, Music } from "lucide-react";
import { isListening, type AdminNowPlayingDto } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { getBackendBase } from "../../../lib/backendBase";
// La règle d'adresse des pochettes d'Octave, la même ici (module pur, sans le moteur).
import { artworkSrcOf } from "../../../music/octave/components/artworkSrc";
import { Poster } from "./Poster";

/**
 * L'image d'une lecture en cours : l'affiche (2:3) d'une vidéo, la pochette
 * CARRÉE d'une écoute (`listening.ts`).
 *
 * - Un élément de Jellyfin : son image, par le client Jellyfin (la pochette
 *   de l'album pour un titre qui n'en a pas, le serveur l'a déjà choisie).
 * - Une lecture d'extension : l'adresse déclarée par le lecteur, résolue par
 *   LA règle d'Octave (`artworkSrc.ts`) : la carte charge la pochette comme
 *   Octave la charge — une adresse https tierce telle quelle, sans jeton.
 */
export function SessionArtwork({ item }: { item: AdminNowPlayingDto }) {
  const client = useJellyfinClient();
  const listening = isListening(item);
  const src = item.imageUrl
    ? artworkSrcOf(item.imageUrl, { baseUrl: getBackendBase(), token: client.getToken(), useCredentials: client.useCredentials })
    : item.imageItemId
      ? client.getImageUrl(item.imageItemId, "Primary", { width: listening ? 240 : 160, quality: 80, tag: item.imageTag })
      : null;
  return listening ? (
    <Poster src={src} width={120} height={120} icon={Music} className="h-[120px] w-[120px] shrink-0 rounded-lg bg-fill-soft" />
  ) : (
    <Poster src={src} width={80} height={120} icon={Film} className="h-[120px] w-20 shrink-0 rounded-lg bg-fill-soft" />
  );
}
