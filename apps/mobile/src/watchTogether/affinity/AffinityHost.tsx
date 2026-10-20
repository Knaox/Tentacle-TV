import { useCallback } from "react";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAffinitySession, useWatchTogether } from "@tentacle-tv/api-client";
import { memberName } from "@tentacle-tv/shared";
import { showToast } from "@/notices/toastStore";
import { closeWtSheet } from "../wtSheets";
import { pushWtNotice } from "../notices/wtNotices";
import { isPlayerPath } from "@tentacle-tv/shared";
import { AffinityModalNative } from "./AffinityModalNative";

/**
 * L'affinité — la racine du mobile, montée par l'hôte tant qu'on est dans
 * une salle (et remontée à chaque salle : les numéros d'état repartent de
 * zéro). La séance (lecture, `wt:affinity`, reconnexions) est celle de
 * l'api-client (`useAffinitySession`) ; ici, les gestes du mobile et la
 * modale. Le pendant de `AffinityRoot` du web.
 */
export function AffinityHost() {
  const { room, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useAffinitySession({
    selfId: selfId ?? "",
    nameOf: (userId) => memberName(room, userId),
    toast: (kind, message) => {
      if (isPlayerPath(pathname)) pushWtNotice(kind, message);
      else showToast({ title: message, tone: kind === "error" ? "failure" : kind });
    },
    t: (key, options) => t(key, options) as string,
    isWatching: () => isPlayerPath(pathname),
    // La pile s'ouvre chez moi : la feuille du groupe qui la couvrirait se ferme.
    onDeckOpened: closeWtSheet,
  });

  const openTitle = useCallback((target: { watchId: string } | { detailId: string }) => {
    if ("watchId" in target) router.push(`/watch/${target.watchId}`);
    else router.push(`/media/${target.detailId}`);
  }, [router]);

  return <AffinityModalNative onStale={refresh} onOpenTitle={openTitle} />;
}

