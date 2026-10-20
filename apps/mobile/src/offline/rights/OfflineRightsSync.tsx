import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { completeItemIds } from "@tentacle-tv/offline-core";
import { useServerCapability, useUserId } from "@tentacle-tv/api-client";
import { localDb } from "../database";
import { subscribeOfflineChanged } from "../engineRuntime";
import { useConnectivity } from "../useConnectivity";
import { offlineVerdictsEnabled, offlineVerdictsKey, syncOfflineVerdicts } from "./offlineVerdictSync";

/** Les titres COMPLETS gardés par l'identité, joints (une valeur stable pour la clé de requête). */
function keptIdsOf(identity: string | null): string {
  if (!identity) return "";
  try {
    return completeItemIds(localDb(), identity).join(",");
  } catch {
    return "";
  }
}

function useKeptIds(identity: string | null): string {
  const [ids, setIds] = useState(() => keptIdsOf(identity));
  useEffect(() => {
    setIds(keptIdsOf(identity));
    return subscribeOfflineChanged(() => setIds(keptIdsOf(identity)));
  }, [identity]);
  return ids;
}

/**
 * Les titres gardés jugés par le serveur pour l'identité EN SESSION (capacité
 * `offline.verdicts`) : à chaque passage en ligne, à chaque titre gardé ou
 * retiré, et dès qu'un droit change au bureau (`rights:changed` invalide la
 * requête, `useRightsLive`). Hors ligne, le dernier verdict fait foi. Ne rend rien.
 */
export function OfflineRightsSync() {
  const identity = useUserId() ?? null;
  const capable = useServerCapability("offline.verdicts");
  const { state } = useConnectivity();
  const keptIds = useKeptIds(identity);
  useQuery({
    queryKey: offlineVerdictsKey(identity, keptIds),
    queryFn: () => syncOfflineVerdicts(identity as string, keptIds ? keptIds.split(",") : []),
    enabled: offlineVerdictsEnabled({ online: state === "online", capable, identity }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return null;
}
