import { useEffect } from "react";
import { AppState } from "react-native";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { clearPlaybackMarker, writePlaybackMarker, type PlaybackMarker } from "@tentacle-tv/tv-core/playback";
import { sessionOwnerOf } from "../auth/sessionOwner";
import { randomSessionId } from "../utils/playerHelpers";

/** Le lecteur à l'écran dit qu'il vit, à ce rythme : la fraîcheur de la relance en dépend. */
const REFRESH_MS = 30_000;

/**
 * Le marqueur de la relance à froid (règle : tv-core `playback/coldStart`),
 * tenu par le lecteur : posé à l'ouverture, `background` quand l'app est
 * quittée, `playing` à son retour, rafraîchi tant qu'il est à l'écran, retiré
 * quand on quitte le lecteur — le sien seulement : l'épisode suivant monte
 * avant que le précédent ne parte.
 *
 * Jamais rafraîchi en arrière-plan : une app gardée vivante des heures hors de
 * l'écran (Android TV) ne doit pas paraître quittée à l'instant.
 */
export function useTVPlaybackMarker(itemId: string): void {
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();

  useEffect(() => {
    const owner = sessionOwnerOf(storage, client.getDeviceId());
    if (!owner || !itemId) return undefined;
    const playerId = randomSessionId();
    let phase: PlaybackMarker["phase"] = AppState.currentState === "background" ? "background" : "playing";
    const put = () => writePlaybackMarker(storage, { itemId, owner, phase, at: Date.now(), playerId });
    put();
    const timer = setInterval(() => { if (phase === "playing") put(); }, REFRESH_MS);
    const sub = AppState.addEventListener("change", (state) => {
      // L'inactivité (centre de contrôle, Siri) ne change rien : l'app est encore à l'écran.
      if (state !== "background" && state !== "active") return;
      phase = state === "background" ? "background" : "playing";
      put();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      clearPlaybackMarker(storage, playerId);
    };
  }, [itemId, storage, client]);
}
