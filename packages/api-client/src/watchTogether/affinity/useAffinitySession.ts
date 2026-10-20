import { useCallback, useEffect, useRef } from "react";
import { onSocketStatus, subscribeSocket, type SocketStatus } from "../../socket/tentacleSocket";
import { fetchAffinity } from "../affinityApi";
import { handleAffinityMessage, reconcileAffinity, type AffinityEventContext } from "./affinityEvents";
import { affinityFetchMark, applyAffinityFetch, resetAffinity } from "./affinityStore";

/**
 * Affinité — la séance tenue à jour pour une salle, sans interface : lue au
 * montage et à chaque reconnexion du socket (un participant qui recharge
 * retrouve sa pile), `wt:affinity` appliqué au magasin, magasin vidé au
 * démontage. La plateforme monte ce crochet tant qu'elle est dans une salle —
 * remonté à chaque changement de salle : les numéros d'état repartent de zéro —
 * et rend la modale et la pilule depuis `useAffinityStore()`.
 *
 * `ctx` est relu à chaque événement (une ref) : il peut changer à chaque rendu.
 * Rend `refresh`, pour relire la séance quand l'écran la sait périmée.
 */
export function useAffinitySession(ctx: AffinityEventContext): () => void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const alive = useRef(false);

  // Relit la séance, puis accorde l'écran à ce qu'elle est devenue.
  const refresh = useCallback(() => {
    const mark = affinityFetchMark();
    fetchAffinity()
      .then((state) => {
        if (alive.current && applyAffinityFetch(state, mark)) reconcileAffinity(ctxRef.current);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();
    const unsubscribe = subscribeSocket((msg) => {
      if (msg.type === "wt:affinity") handleAffinityMessage(msg, ctxRef.current);
    });
    // Une coupure a pu manquer des états : relire à la reconnexion.
    let previous: SocketStatus | null = null;
    const unsubscribeStatus = onSocketStatus((status) => {
      if (status === "open" && previous !== null && previous !== "open") refresh();
      previous = status;
    });
    return () => {
      alive.current = false;
      unsubscribe();
      unsubscribeStatus();
      resetAffinity();
    };
  }, [refresh]);

  return refresh;
}
