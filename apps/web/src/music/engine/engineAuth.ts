/**
 * L'authentification du moteur audio, lue dans la page : la racine du serveur
 * Tentacle (`/api/music/...` y vit — pas le proxy Jellyfin), le jeton et le
 * mode cookie du client. Module léger : la bascule de la barre de Tentacle
 * s'en sert sans charger les moteurs.
 */

import { useMemo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { getBackendBase } from "../../lib/backendBase";
import type { MusicEngineAuth } from "./engineShared";

export function useMusicEngineAuth(): MusicEngineAuth {
  const client = useJellyfinClient();
  // La racine du serveur TENTACLE, pas celle du proxy Jellyfin
  // (`client.getBaseUrl()` = `…/api/jellyfin` : le flux y devenait `/api/jellyfin/api/music/stream`).
  const baseUrl = getBackendBase();
  const token = client.getToken();
  const useCredentials = client.useCredentials;
  return useMemo<MusicEngineAuth>(() => ({ baseUrl, token, useCredentials }), [baseUrl, token, useCredentials]);
}
