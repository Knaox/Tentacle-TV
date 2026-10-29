/**
 * Octave (mobile) — la reprise de la session du lecteur (règle PARTAGÉE `attachPlayerResume`, api-client) sur le
 * stockage préchargé de l'app (`tentacle_octave_player` dans la liste de `RNStorageAdapter`), sauvée aussi
 * quand l'app passe en arrière-plan (Android peut la fermer ensuite). L'identité : le serveur et le compte de la
 * session (`tentacle_user`, un profil de la Famille compris). Reprise DANS LE MÊME LANCEMENT seulement : le
 * lancement vient du module natif (`octaveAudioLaunchId` : le processus, et sur Android chaque balayage de l'app,
 * même si le JS lui survit) — l'app fermée pour de bon repart de zéro. Module d'avant : le moteur JS fait foi.
 */

import { AppState } from "react-native";
import type { PlayerResumeDeps } from "@tentacle-tv/api-client";
import type { SyncStorage } from "@tentacle-tv/shared/octave";
import { octaveAudioLaunchId } from "../../../modules/octave-audio";

/** Repli sans module natif récent : ce moteur JS (un rechargement du JS est un nouveau lancement). */
const JS_LAUNCH = `js-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function mobileLaunchId(): string {
  return octaveAudioLaunchId() ?? JS_LAUNCH;
}

export function octaveOwnerOf(storage: SyncStorage, baseUrl: string): string | null {
  try {
    const raw = storage.getItem("tentacle_user");
    const id = raw ? (JSON.parse(raw) as { Id?: unknown }).Id : null;
    return typeof id === "string" && id !== "" && baseUrl !== "" ? `${baseUrl}|${id}` : null;
  } catch {
    return null;
  }
}

export function mobileResumeDeps(storage: SyncStorage, baseUrl: string): PlayerResumeDeps {
  return {
    storage,
    ownerNow: () => octaveOwnerOf(storage, baseUrl),
    launchId: mobileLaunchId,
    onHide: (save) => {
      const sub = AppState.addEventListener("change", (state) => {
        if (state !== "active") save();
      });
      return () => sub.remove();
    },
  };
}
