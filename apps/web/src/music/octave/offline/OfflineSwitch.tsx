/**
 * Octave — « Passer hors ligne » / « Revenir en ligne » (`offlineSwitchRule.ts`),
 * sur le MÊME état que le mode films (`setManualOffline`). Trois places, là où
 * ça tombe sous la main :
 *   - le menu du profil d'Octave, au pied de la barre latérale — le même geste
 *     que le menu de l'avatar de Tentacle (`OfflineSwitchMenuItem`) ;
 *   - l'en-tête de « Sur cet appareil », à côté de « Lecture » : ce qu'on y voit
 *     est ce qui restera (`OfflineSwitchButton`) ;
 *   - hors ligne, l'avis de « Sur cet appareil » porte la sortie : « Revenir en
 *     ligne », ou « Réessayer la connexion » quand le serveur ne répond pas
 *     (`OfflineNotice`).
 * Rien sur le web ni dans une session de profil.
 */

import { useCallback, useMemo, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveProfile } from "../../../auth/profileSession";
import { PressableGlass } from "../../../components/ui/glass/PressableGlass";
import { supportsDownloads } from "../../../desktop/bridge";
import { probeNow, setManualOffline } from "../../../offline/connectivityStore";
import { useConnectivity } from "../../../offline/useConnectivity";
import { SECONDARY_CAPSULE_PROPS } from "../components/CollectionHeader";
import { offlineSwitchOf, type OfflineSwitchKind } from "./offlineSwitchRule";
import { useOfflineSurface } from "./offlineSurfaceContext";
import { useKeptMusic } from "./useKeptMusic";

export function useOfflineSwitch(): { kind: OfflineSwitchKind | null; run: () => Promise<void> } {
  const { state } = useConnectivity();
  const profileSession = useActiveProfile() !== null;
  const surface = useOfflineSurface();
  const { tracks } = useKeptMusic();
  const hasPlayable = useMemo(() => tracks.some((k) => k.status === "complete"), [tracks]);
  const kind = offlineSwitchOf({ desktop: supportsDownloads(), state, profileSession, surfaceVisible: surface.visible, hasPlayable });
  const run = useCallback(() => applyOfflineSwitch(kind), [kind]);
  return { kind, run };
}

/** Le geste : le même état que le mode films ; « Réessayer » rend la sonde, que le bouton attend. */
export async function applyOfflineSwitch(kind: OfflineSwitchKind | null): Promise<void> {
  if (kind === "goOffline") setManualOffline(true);
  else if (kind === "goOnline") setManualOffline(false);
  else if (kind === "retry") await probeNow(true);
}

/** L'entrée du menu du profil : passer hors ligne, ou en revenir. */
export function OfflineSwitchMenuItem({ className, onDone }: { className: string; onDone: () => void }) {
  const { t } = useTranslation("musicOffline");
  const { kind, run } = useOfflineSwitch();
  if (kind !== "goOffline" && kind !== "goOnline") return null;
  const Icon = kind === "goOffline" ? WifiOff : Wifi;
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      title={kind === "goOffline" ? t("switch.goOfflineHint") : undefined}
      onClick={() => {
        onDone();
        void run();
      }}
      data-octave-offline-switch={kind}
    >
      <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
      {t(`switch.${kind}`)}
    </button>
  );
}

/** La capsule de l'en-tête de « Sur cet appareil » (en ligne seulement). */
export function OfflineSwitchButton() {
  const { t } = useTranslation("musicOffline");
  const { kind, run } = useOfflineSwitch();
  if (kind !== "goOffline") return null;
  return (
    <PressableGlass {...SECONDARY_CAPSULE_PROPS} hoverScale={1.03} tapScale={0.97} title={t("switch.goOfflineHint")} onClick={() => void run()} data-octave-offline-switch={kind}>
      <WifiOff className="h-4 w-4" aria-hidden />
      <span className="relative">{t("switch.goOffline")}</span>
    </PressableGlass>
  );
}

const NOTICE_ACTION =
  "ml-auto inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-octave-line bg-octave-hover px-4 text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-octave-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:opacity-50";

/** L'avis hors ligne de « Sur cet appareil », et sa sortie. */
export function OfflineNotice() {
  const { t } = useTranslation("musicOffline");
  const { kind, run } = useOfflineSwitch();
  const [busy, setBusy] = useState(false);
  const act = useCallback(() => {
    setBusy(true);
    void run().finally(() => setBusy(false));
  }, [run]);
  const action = kind === "goOnline" || kind === "retry" ? kind : null;
  return (
    <div className="mx-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-fill-subtle px-4 py-3 text-sm text-content-secondary">
      <p className="flex min-w-0 items-center gap-2" role="status">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        {t(kind === "goOnline" ? "switch.manualHint" : "view.offlineHint")}
      </p>
      {action && (
        <button type="button" className={NOTICE_ACTION} onClick={act} disabled={busy} aria-busy={busy} data-octave-offline-switch={action}>
          <Wifi className="h-4 w-4" aria-hidden />
          {t(`switch.${action}`)}
        </button>
      )}
    </div>
  );
}
