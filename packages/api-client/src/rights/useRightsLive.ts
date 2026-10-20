import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import type { WsServerMessage } from "@tentacle-tv/shared";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { acquireSocket, subscribeSocket } from "../socket/tentacleSocket";

/** Ce qui ne dépend pas des droits du compte : la configuration du serveur (ses capacités). */
const RIGHTS_NEUTRAL_KEYS = new Set(["app-config"]);

const dependsOnRights = (queryKey: readonly unknown[]) => !RIGHTS_NEUTRAL_KEYS.has(String(queryKey[0]));

/**
 * Les droits du compte (ou du profil de la session) viennent de changer : tout
 * ce qui est À L'ÉCRAN se relit (les listes perdent un titre devenu interdit,
 * la fiche ouverte dit qu'il n'est plus là, les droits de lecture et les
 * verdicts des titres gardés hors ligne se refont), et ce qui ne l'est pas est
 * OUBLIÉ — un retour en arrière ne remontre pas une liste d'avant. Rien ne
 * clignote : une requête affichée garde ses données le temps de la relecture.
 */
export function applyRightsChanged(qc: QueryClient): void {
  qc.removeQueries({ type: "inactive", predicate: (query) => dependsOnRights(query.queryKey) });
  void qc.invalidateQueries({ predicate: (query) => dependsOnRights(query.queryKey) });
}

export interface UseRightsLiveOptions {
  /** Auth par message (bureau, mobile, TV) ; undefined = cookie (web). */
  token?: string | null;
  enabled?: boolean;
}

/**
 * Les droits en direct (`rights:changed`, capacité `rights.live`) : un droit
 * réglé au bureau ou sur le web s'applique sur cet appareil SANS redémarrage.
 * Le serveur décide toujours ; ce crochet ne fait que relire. Consomme le
 * socket PARTAGÉ ; un seul montage suffit par application.
 */
export function useRightsLive(options: UseRightsLiveOptions = {}): void {
  const { token, enabled = true } = options;
  const qc = useQueryClient();
  const capable = useServerCapability("rights.live");
  const active = enabled && capable;

  useEffect(() => {
    if (!active) return;
    const release = acquireSocket(token ?? undefined);
    const off = subscribeSocket((msg: WsServerMessage) => {
      if (msg.type === "rights:changed") applyRightsChanged(qc);
    });
    return () => {
      off();
      release();
    };
  }, [active, token, qc]);
}
