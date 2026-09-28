import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchAffinity, onSocketStatus, subscribeSocket, type SocketStatus } from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { handleAffinityMessage, reconcileAffinity, type AffinityEventContext } from "./affinityEvents";
import { affinityFetchMark, applyAffinityFetch, resetAffinity } from "./affinityStore";
import { memberName } from "./affinityText";
import { AffinityModal } from "./AffinityModal";
import { AffinityPill } from "./AffinityPill";

/**
 * Affinité — la racine, montée par le fournisseur Watch Together tant qu'on
 * est dans une salle (et remontée à chaque changement de salle : les numéros
 * d'état repartent de zéro). Elle lit la séance au montage et à chaque
 * reconnexion du socket — un participant qui recharge la page retrouve sa
 * pile ouverte —, écoute `wt:affinity`, et porte la modale et la pilule.
 */
export function AffinityRoot() {
  const { room, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const location = useLocation();

  const ctxRef = useRef<AffinityEventContext | null>(null);
  ctxRef.current = {
    selfId: selfId ?? "",
    nameOf: (userId) => memberName(room, userId),
    toast: show,
    t: (key, options) => t(key, options) as string,
    isWatching: () => location.pathname.startsWith("/watch/"),
  };

  const alive = useRef(false);
  // Relit la séance, puis accorde l'écran à ce qu'elle est devenue.
  const refresh = useCallback(() => {
    const mark = affinityFetchMark();
    fetchAffinity()
      .then((state) => {
        if (alive.current && applyAffinityFetch(state, mark) && ctxRef.current) reconcileAffinity(ctxRef.current);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();

    const unsubscribe = subscribeSocket((msg) => {
      if (msg.type === "wt:affinity" && ctxRef.current) handleAffinityMessage(msg, ctxRef.current);
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

  return (
    <>
      <AffinityModal onStale={refresh} />
      <AffinityPill />
    </>
  );
}
