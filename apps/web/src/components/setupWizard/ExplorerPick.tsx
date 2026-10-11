import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen } from "lucide-react";
import { AdminNotice } from "../admin/kit";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";

type Notice = { kind: "mapped"; path: string; unc: string } | { kind: "notFound"; path: string };

/**
 * L'app Windows, navigateur sur le PC même : « Parcourir avec l'Explorateur ».
 * La boîte s'ouvre sur l'écran du PC (l'hôte de l'app), le dossier choisi
 * repasse par Jellyfin — c'est lui qui doit le voir. Un lecteur réseau mappé
 * qu'il ne voit pas : son chemin réseau est proposé d'un geste.
 */
export function ExplorerPick({ name, current, primary, onPick }: { name: string; current: string | null; primary: boolean; onPick: (path: string) => void }) {
  const { t } = useTranslation("setupWizard");
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<WizardErrorCode | null>(null);

  const pick = async () => {
    setPicking(true);
    setNotice(null);
    setError(null);
    try {
      const title = name.trim() ? t("explorerTitle", { name: name.trim() }) : t("explorerTitleUnnamed");
      const result = await setupApi.pickFolder({ ...(current ? { initial: current } : {}), title });
      if (result.status === "picked") onPick(result.path);
      else if (result.status === "mapped_drive") setNotice({ kind: "mapped", path: result.path, unc: result.unc });
      else if (result.status === "not_found") setNotice({ kind: "notFound", path: result.path });
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void pick()} disabled={picking} className={primary ? cls.bbrand : cls.bs}>
        <FolderOpen size={16} aria-hidden="true" />
        {t("explorerPick")}
      </button>
      {picking ? <p className="text-xs text-content-tertiary" aria-live="polite">{t("explorerPicking")}</p> : null}
      {notice?.kind === "mapped" ? (
        <AdminNotice
          tone="warning"
          action={
            <button
              type="button"
              onClick={() => {
                onPick(notice.unc);
                setNotice(null);
              }}
              className={cls.bs}
            >
              {t("explorerUseUnc", { unc: notice.unc })}
            </button>
          }
        >
          {t("explorerMapped", { path: notice.path, unc: notice.unc })}
        </AdminNotice>
      ) : null}
      {notice?.kind === "notFound" ? <AdminNotice tone="warning">{t("explorerNotFound", { path: notice.path })}</AdminNotice> : null}
      <SetupErrorLine code={error} />
    </div>
  );
}
