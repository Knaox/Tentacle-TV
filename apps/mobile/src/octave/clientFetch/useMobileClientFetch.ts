/**
 * Octave (mobile) — le téléphone exécute les requêtes que l'extension musique lui confie (capacité
 * `plugins.clientFetch`, comme le bureau) : recherche, vues, `player`… partent de SA connexion, sous la garde
 * que l'extension tient pour CET appareil ; le serveur ne reprend qu'au clic, s'il est muet. Monté seulement si
 * le module audio sait lire le flux direct qui en résulte (`directStreams`) : sinon l'URL obtenue par le
 * téléphone ne servirait à rien (le serveur ne peut pas la relayer) et l'extension paierait deux fois.
 */

import { useEffect, useMemo } from "react";
import { useClientFetchAgent, type ClientFetchExecutor } from "@tentacle-tv/api-client";
import { octaveAudioSupportsDirect } from "../../../modules/octave-audio";
import { mobileManifests, runDelegatedOnPhone } from "./phoneDelegation";

export function useMobileClientFetch(enabled: boolean, token: string | null): void {
  const on = enabled && octaveAudioSupportsDirect();
  const executor = useMemo<ClientFetchExecutor | null>(() => (on ? runDelegatedOnPhone : null), [on]);
  useEffect(() => {
    // Un autre compte (profil de la Famille) : ses extensions peuvent différer.
    mobileManifests.reset();
    if (on) mobileManifests.warm();
  }, [on, token]);
  useClientFetchAgent(executor, token);
}
