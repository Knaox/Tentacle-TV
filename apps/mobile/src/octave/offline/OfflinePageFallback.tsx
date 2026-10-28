/**
 * Octave (mobile) — une page du serveur HORS LIGNE et sans donnée (`offlinePageRule.ts`) :
 * la collection gardée sur cet appareil quand elle existe (la vue « Sur cet
 * appareil » ouverte sur elle, à la place), sinon « Pas disponible hors ligne »
 * et le chemin vers ce qui l'est. Jamais une page vide, jamais « Réessayer ».
 */

import { memo } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { HardDrive, WifiOff } from "lucide-react-native";
import { useOctaveNav } from "../pages/env/nav";
import { EmptyState, PillButton } from "../pages/ui/ViewStates";
import { OctaveTopBar } from "../layout/OctaveTopBar";
import { useOctavePageScroll } from "../layout/useOctavePageScroll";
import { OctaveDeviceScreen } from "./OctaveDeviceScreen";
import { useOfflineSurface } from "./musicOfflineContext";

export const OfflinePageFallback = memo(function OfflinePageFallback({ keptKey }: { keptKey: string | null }) {
  if (keptKey) return <OctaveDeviceScreen params={{ c: keptKey }} />;
  return <OfflineMissing />;
});

function OfflineMissing() {
  const { scrollY } = useOctavePageScroll();
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <OfflineMissingState />
      <OctaveTopBar scrollY={scrollY} title="" />
    </View>
  );
}

/** « Pas disponible hors ligne », seul : l'état vide d'une liste (bibliothèque, playlists) sans donnée gardée. */
export function OfflineMissingState() {
  const { t } = useTranslation("musicOffline");
  const nav = useOctaveNav();
  const surface = useOfflineSurface();
  return (
    <EmptyState
      icon={WifiOff}
      title={t("page.missingTitle")}
      hint={t("page.missingHint")}
      action={surface.visible ? <PillButton icon={HardDrive} label={t("page.openDevice")} onPress={() => nav.device()} /> : undefined}
    />
  );
}
