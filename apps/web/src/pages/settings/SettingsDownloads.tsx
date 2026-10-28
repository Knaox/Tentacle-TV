/**
 * Réglages › Téléchargements (desktop uniquement, invisible sans droit ni
 * contenu). Emplacement de stockage : affiché partout, MODIFIABLE hors macOS
 * (bac à sable Mac App Store, sans entitlement fichiers — décision v1) et
 * uniquement quand aucun téléchargement n'existe (pas de migration auto).
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { desktopPlatform, isDesktopApp } from "../../desktop/bridge";
import { pickFolder } from "../../desktop/bridge";
import { isAppStoreBuild } from "../../hooks/mpvRuntime";
import { getDownloadsRoot, setDownloadsRoot } from "../../downloads/api";
import { formatBytes } from "../../downloads/presets";
import { useDiskInfo, useDownloadsVisibility, DISK_INFO_QUERY_KEY } from "../../downloads/useDownloadState";
import { useToast } from "../../contexts/ToastContext";
import { SettingItem } from "../../components/settings/wide/SettingItem";
import { WideGroup } from "../../components/settings/wide/WideGroup";
import { SETTING_BUTTON } from "../../components/settings/wide/settingButtons";
import { BackgroundTransfersSetting } from "../../components/settings/BackgroundTransfersSetting";

export function SettingsDownloads() {
  const { t } = useTranslation("downloads");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const { visible } = useDownloadsVisibility();
  const { freeBytes, usedBytes } = useDiskInfo();
  const [root, setRoot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isDesktopApp()) return;
    void getDownloadsRoot().then(setRoot);
  }, []);

  if (!isDesktopApp() || !visible) return <Navigate to="/settings" replace />;

  // ⚠️ macOS n'offre PAS le choix, quelle que soit la coquille : l'application
  // y est distribuée par le Mac App Store, donc en bac à sable, et le dossier
  // de téléchargement est celui que le système lui accorde. `isAppStoreBuild()`
  // ne suffit pas — il est faux en développement, où le bouton apparaissait
  // alors qu'il ne peut rien donner. L'emplacement reste AFFICHÉ, en lecture
  // seule : le masquer laisserait l'utilisateur sans savoir où vont ses films.
  const canPickFolder = !isAppStoreBuild() && desktopPlatform() !== "macos";

  const handleChange = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickFolder();
      if (picked) {
        const result = await setDownloadsRoot(picked);
        if (result.ok) {
          setRoot(result.path);
          queryClient.invalidateQueries({ queryKey: [DISK_INFO_QUERY_KEY] });
          show("success", t("locationChanged"));
        } else if (result.code === "root-not-empty") {
          show("error", t("locationLocked"));
        } else if (result.code === "root-not-writable") {
          // La cause système est AFFICHÉE quand le natif la donne. Sans elle,
          // un refus dans un paquet livré se réduisait à « pas accessible en
          // écriture », sans recours — alors que l'accès contrôlé aux dossiers
          // de Windows, une ACL et un volume en lecture seule appellent trois
          // gestes différents.
          show(
            "error",
            result.detail
              ? t("locationNotWritableWhy", { reason: result.detail })
              : t("locationNotWritable"),
          );
        } else {
          // `unknown` n'est PAS un problème d'écriture : le dire l'était déjà
          // trop souvent. Un canal absent ou un rejet inattendu se distingue.
          show("error", t("locationFailed"));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <WideGroup section="downloads" group="storage">
        <SettingItem
          setting="downloadsLocation"
          note={!canPickFolder && desktopPlatform() === "macos" ? t("locationFixedBySystem") : canPickFolder ? t("locationHint") : undefined}
          trailing={canPickFolder ? (
            <button type="button" onClick={() => void handleChange()} disabled={busy} className={SETTING_BUTTON}>
              {t("changeLocation")}
            </button>
          ) : undefined}
        >
          <p className="break-all rounded-lg bg-fill-subtle px-3 py-2 font-mono text-xs text-content-secondary">{root ?? "…"}</p>
        </SettingItem>
        <SettingItem setting="downloadsSpace">
          <div className="space-y-1 text-xs text-content-tertiary">
            <p>{t("spaceUsed", { size: formatBytes(usedBytes) })}</p>
            <p>{t("freeSpace", { size: formatBytes(freeBytes) })}</p>
          </div>
        </SettingItem>
      </WideGroup>
      <WideGroup section="downloads" group="transfers">
        <BackgroundTransfersSetting />
      </WideGroup>
    </div>
  );
}
