import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, CornerLeftUp, Folder, HardDrive } from "lucide-react";
import type { BrowseResult } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";

/**
 * Le sélecteur de dossier : le système de fichiers DE JELLYFIN (dans un
 * conteneur, ce n'est pas celui de l'hôte), parcouru par l'API. Un panneau
 * dans le flux de l'écran, pas une fenêtre par-dessus : rien à piéger au
 * clavier. Sa racine suit la machine de Jellyfin : `/` sous Linux, les
 * lecteurs (C:, D:…) sous Windows.
 */
export function FolderBrowser({ start, onPick, onCancel }: { start: string | null; onPick: (path: string) => void; onCancel: () => void }) {
  const { t } = useTranslation("setupWizard");
  const [path, setPath] = useState<string | null>(start);
  const [listing, setListing] = useState<BrowseResult | null>(null);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [attempt, setAttempt] = useState(0);
  const style = listing?.style ?? "posix";
  const atDrives = listing?.path === null && style === "windows";

  useEffect(() => {
    let cancelled = false;
    setListing(null);
    setError(null);
    setupApi
      .browse(path ?? undefined)
      .then((result) => !cancelled && setListing(result))
      .catch((err) => !cancelled && setError(err instanceof SetupApiError ? err.code : "internal"));
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  return (
    <div className="space-y-3 rounded-xl border border-[rgba(var(--brand-rgb),0.4)] bg-fill-faint p-4" role="group" aria-label={t("browserTitle")}>
      <p className="text-sm font-semibold text-content-primary">{t("browserTitle")}</p>
      <p className="text-xs text-content-tertiary">{t(`pathHint_${style}`)}</p>
      <p className="break-all rounded-lg bg-fill-subtle px-3 py-2 font-mono text-xs text-content-secondary">{listing?.path ?? t(`browserRoot_${style}`)}</p>
      <SetupErrorLine code={error} onRetry={() => setAttempt((n) => n + 1)} />
      <ul className="max-h-64 divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line-subtle">
        {listing?.parent !== undefined && listing?.path !== null ? (
          <li>
            <button type="button" onClick={() => setPath(listing?.parent ?? null)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-content-secondary hover:bg-fill-subtle">
              <CornerLeftUp size={16} aria-hidden="true" />
              {t("browserUp")}
            </button>
          </li>
        ) : null}
        {listing?.entries.map((entry) => (
          <li key={entry.path}>
            <button type="button" onClick={() => setPath(entry.path)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-content-primary hover:bg-fill-subtle">
              {atDrives ? (
                <HardDrive size={16} aria-hidden="true" className="shrink-0 text-content-tertiary" />
              ) : (
                <Folder size={16} aria-hidden="true" className="shrink-0 text-content-tertiary" />
              )}
              <span className="min-w-0 flex-1 truncate">{atDrives ? t("browserDrive", { name: entry.name.replace(/[\\/]+$/, "") }) : entry.name}</span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-content-quaternary" />
            </button>
          </li>
        ))}
        {listing && listing.entries.length === 0 ? <li className="px-3 py-3 text-sm text-content-tertiary">{t("browserEmpty")}</li> : null}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => listing?.path && onPick(listing.path)} disabled={!listing?.path} className={cls.bbrand}>
          {t("browserChoose")}
        </button>
        <button type="button" onClick={onCancel} className={cls.bs}>
          {t("browserCancel")}
        </button>
      </div>
    </div>
  );
}
