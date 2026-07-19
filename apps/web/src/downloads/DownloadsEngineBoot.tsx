/**
 * Démarre le moteur de téléchargement Rust dès qu'une session desktop est en
 * ligne : credentials (serveur + token) poussés en mémoire moteur, file
 * normalisée (transferts interrompus/pauses système → reprise auto).
 * Re-déclenché à chaque retour en ligne et à chaque changement de compte.
 * Ne rend rien.
 */

import { useEffect } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { backendUrl, isTauriApp } from "../main";
import { useConnectivity } from "../offline/useConnectivity";
import { engineStart } from "./api";

export function DownloadsEngineBoot() {
  const userId = useUserId();
  const { state } = useConnectivity();

  useEffect(() => {
    if (!isTauriApp || !userId || state !== "online") return;
    try {
      const token = localStorage.getItem("tentacle_token");
      if (token) void engineStart(backendUrl, token);
    } catch {
      /* localStorage inaccessible : le moteur restera inactif. */
    }
  }, [userId, state]);

  return null;
}
