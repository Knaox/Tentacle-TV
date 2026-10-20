/**
 * Démarre le moteur de téléchargement Rust dès qu'une session desktop est en
 * ligne : credentials (serveur + token) poussés en mémoire moteur, file
 * normalisée (transferts interrompus/pauses système → reprise auto).
 * Re-déclenché à chaque retour en ligne et à chaque changement de compte.
 * Le hors ligne appartient au COMPTE de l'appareil (`offlineOwner.ts`) : le
 * moteur prend SON jeton, même pendant la session d'un profil — un lot lancé
 * par le compte continue en coulisse. Ne rend rien.
 */

import { useEffect } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { backendUrl } from "../main";
import { supportsDownloads } from "../desktop/bridge";
import { useConnectivity } from "../offline/useConnectivity";
import { readOfflineOwner } from "../offline/offlineOwner";
import { engineStart } from "./api";
import { primeDownloadsRoot } from "./localFiles";

export function DownloadsEngineBoot() {
  const userId = useUserId();
  const { state } = useConnectivity();

  // Racine locale résolue tôt (affiches/méta immédiates, en ligne comme hors
  // ligne — l'appel est purement local).
  useEffect(() => {
    if (supportsDownloads()) primeDownloadsRoot();
  }, []);

  useEffect(() => {
    if (!supportsDownloads() || !userId || state !== "online") return;
    const token = readOfflineOwner()?.token;
    if (token) void engineStart(backendUrl, token);
  }, [userId, state]);

  return null;
}
