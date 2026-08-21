import { useEffect, useRef } from "react";
import { killActiveEncoding, useJellyfinClient } from "@tentacle-tv/api-client";
import { oublierSessionEncodage, reprendreSessionEncodage } from "@/lib/transcodeSession";

const DBG = "[Tentacle:Playback]";

/**
 * Filet au lancement : libère l'encodage laissé par un arrêt brutal.
 *
 * Une application balayée, tuée par le système ou qui plante en pleine lecture
 * n'exécute plus rien — ni démontage, ni rapport d'arrêt. L'encodage survit
 * côté Jellyfin, et ses fichiers avec. Le lancement suivant est la première
 * occasion de le refermer : on relit la trace posée par le lecteur, on envoie
 * le `DELETE`, et on efface la trace.
 *
 * L'attente sur `reprendreSessionEncodage` n'est pas qu'une lecture : elle rend
 * la main, ce qui laisse les effets du parent s'exécuter d'abord (React purge
 * les effets enfants AVANT ceux du parent). Sans cela, le client n'aurait
 * encore ni URL de base ni jeton au moment de l'appel.
 */
export function TranscodeCleanupSync({ serverUrl }: { serverUrl: string | null }) {
  const client = useJellyfinClient();
  const faitRef = useRef(false);

  useEffect(() => {
    if (faitRef.current || !serverUrl) return;
    faitRef.current = true;

    void (async () => {
      const session = await reprendreSessionEncodage();
      if (!session) return;
      // Pas encore authentifié : on GARDE la trace pour le lancement d'après
      // plutôt que d'émettre un appel qui sera refusé.
      if (!client.getAccessToken()) return;
      // Serveur changé depuis : l'identifiant ne désigne plus rien là-bas.
      if (session.baseUrl !== client.getBaseUrl()) {
        oublierSessionEncodage();
        return;
      }
      console.log(DBG, "session d'encodage orpheline — libération au lancement", session.playSessionId);
      await killActiveEncoding(client, session.playSessionId);
      oublierSessionEncodage();
    })();
  }, [client, serverUrl]);

  return null;
}
