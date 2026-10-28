/**
 * Octave (mobile) — de quoi joindre le serveur Tentacle pour le moteur et les pochettes : sa racine (celle de
 * l'app, pas le proxy Jellyfin), le jeton de la session (un changement de profil le change, et le moteur
 * redémarre avec lui) ; jamais de cookie.
 */

import { useMemo } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MusicEngineAuth } from "@tentacle-tv/shared/octave";
import { useServerUrl } from "@/providers/ServerUrlContext";

export function useMobileEngineAuth(): MusicEngineAuth {
  const client = useJellyfinClient();
  const { serverUrl } = useServerUrl();
  const token = client.getToken();
  return useMemo(() => ({ baseUrl: (serverUrl ?? "").replace(/\/+$/, ""), token, useCredentials: false }), [serverUrl, token]);
}
