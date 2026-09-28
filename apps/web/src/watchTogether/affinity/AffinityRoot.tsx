import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchAffinity, onSocketStatus, subscribeSocket, type SocketStatus } from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { handleAffinityMessage, type AffinityEventContext } from "./affinityEvents";
import { affinityFetchMark, applyAffinityFetch, resetAffinity } from "./affinityStore";
import { memberName } from "./affinityText";
import { AffinityModal } from "./AffinityModal";
import { AffinityPill } from "./AffinityPill";

/**
 * Affinité — la racine, montée par le fournisseur Watch Together tant qu'on
 * est dans une salle (et remontée à chaque changement de salle : les numéros
 * d'état repartent de zéro). Elle lit la séance au montage et à chaque
 * reconnexion du socket, écoute `wt:affinity`, et porte la modale et la
 * pilule d'invitation.
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

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      const mark = affinityFetchMark();
      fetchAffinity()
        .then((state) => {
          if (!cancelled) applyAffinityFetch(state, mark);
        })
        .catch(() => undefined);
    };
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
      cancelled = true;
      unsubscribe();
      unsubscribeStatus();
      resetAffinity();
    };
  }, []);

  return (
    <>
      <AffinityModal />
      <AffinityPill />
    </>
  );
}
