/**
 * Réglages > Téléchargements (desktop uniquement, invisible sans droit ni
 * contenu). Emplacement de stockage : affiché partout, MODIFIABLE hors build
 * Mac App Store (sandbox sans entitlement fichiers — décision v1) et
 * uniquement quand aucun téléchargement n'existe (pas de migration auto).
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { isDesktopApp } from "../../desktop/bridge";
import { pickFolder } from "../../desktop/bridge";
import { isAppStoreBuild } from "../../hooks/mpvRuntime";
import { getDownloadsRoot, setDownloadsRoot } from "../../downloads/api";
import { formatBytes } from "../../downloads/presets";
import { useDiskInfo, useDownloadsVisibility, DISK_INFO_QUERY_KEY } from "../../downloads/useDownloadState";
import { useToast } from "../../contexts/ToastContext";

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

  const canPickFolder = !isAppStoreBuild();

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
        } else {
          show("error", t("locationNotWritable"));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
        <h3 className="text-sm font-semibold text-content-primary">{t("storageLocation")}</h3>
        <p className="mt-1 break-all text-xs text-content-tertiary">{root ?? "…"}</p>
        {canPickFolder && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void handleChange()}
              disabled={busy}
              className="rounded-md border border-line-strong bg-fill-subtle px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft disabled:opacity-50"
            >
              {t("changeLocation")}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-content-quaternary">
              {t("locationHint")}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line-subtle bg-surface-1 p-4">
        <h3 className="text-sm font-semibold text-content-primary">{t("spaceTitle")}</h3>
        <div className="mt-2 space-y-1 text-xs text-content-tertiary">
          <p>{t("spaceUsed", { size: formatBytes(usedBytes) })}</p>
          <p>{t("freeSpace", { size: formatBytes(freeBytes) })}</p>
        </div>
      </section>
    </div>
  );
}
