import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAffinitySession, useWatchTogether } from "@tentacle-tv/api-client";
import { memberName } from "@tentacle-tv/shared";
import { whenNoModal } from "@/components/ui/modalGate";
import { showToast } from "@/notices/toastStore";
import { closeWtSheet } from "../wtSheets";
import { pushWtNotice } from "../notices/wtNotices";
import { isPlayerPath } from "@tentacle-tv/shared";
import { AffinityModalNative } from "./AffinityModalNative";

/**
 * La relecture de la séance, tenue par `AffinityHost` (racine) pour la
 * modale, qui vit ailleurs (`AffinityModalLayer`, dans la couche des
 * feuilles : à la racine ou dans le lecteur).
 */
let refreshSession: () => void = () => undefined;

/**
 * L'affinité — la racine du mobile, montée par l'hôte tant qu'on est dans
 * une salle (et remontée à chaque salle : les numéros d'état repartent de
 * zéro). La séance (lecture, `wt:affinity`, reconnexions) est celle de
 * l'api-client (`useAffinitySession`) ; ici, les gestes du mobile. La
 * modale est montée par la couche des feuilles (`AffinityModalLayer`), là où
 * l'écran est visible. Le pendant de `AffinityRoot` du web.
 */
export function AffinityHost() {
  const { room, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  const pathname = usePathname();

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

  useEffect(() => {
    refreshSession = refresh;
    return () => { if (refreshSession === refresh) refreshSession = () => undefined; };
  }, [refresh]);
  return null;
}

/** La modale de l'affinité, montée par la couche des feuilles (`WtSheetLayer`). */
export function AffinityModalLayer() {
  const router = useRouter();
  // Le lecteur se présente en plein écran : seulement une fois la modale de
  // l'affinité retirée, jamais pendant sa sortie.
  const openTitle = useCallback((target: { watchId: string } | { detailId: string }) => {
    whenNoModal(() => {
      if ("watchId" in target) router.push(`/watch/${target.watchId}`);
      else router.push(`/media/${target.detailId}`);
    });
  }, [router]);
  const onStale = useCallback(() => refreshSession(), []);

  return <AffinityModalNative onStale={onStale} onOpenTitle={openTitle} />;
}
