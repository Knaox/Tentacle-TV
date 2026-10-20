import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { memberName, useAffinitySession } from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { closeRoomModal } from "../roomModalStore";
import { AffinityModal } from "./AffinityModal";
import { AffinityPill } from "./AffinityPill";

/**
 * Affinité — la racine, montée par le fournisseur Watch Together tant qu'on
 * est dans une salle (et remontée à chaque changement de salle : les numéros
 * d'état repartent de zéro). La séance elle-même est tenue par
 * `useAffinitySession` (api-client, partagé avec le mobile) ; ici, la modale
 * et la pilule.
 */
export function AffinityRoot() {
  const { room, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const location = useLocation();

  // La séance (lecture, messages, reconnexions) vit dans api-client ; ici,
  // les gestes du web — dont fermer la modale de salle quand la pile s'ouvre.
  const refresh = useAffinitySession({
    selfId: selfId ?? "",
    nameOf: (userId) => memberName(room, userId),
    toast: show,
    t: (key, options) => t(key, options) as string,
    isWatching: () => location.pathname.startsWith("/watch/"),
    onDeckOpened: closeRoomModal,
  });

  return (
    <>
      <AffinityModal onStale={refresh} />
      <AffinityPill />
    </>
  );
}
