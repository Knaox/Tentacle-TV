import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Trash2 } from "lucide-react";
import type { LibraryPlan, LibraryType } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { isValidLibraryName } from "./wizardModel";

const TYPES: readonly LibraryType[] = ["movies", "tvshows", "mixed"];

/**
 * Une bibliothèque à créer : son nom, son type, son dossier. Sans dossier,
 * le bouton « Choisir le dossier » passe au premier plan — c'est la seule
 * chose qui manque.
 */
export function LibraryPlanRow({ plan, onChange, onBrowse, onRemove }: { plan: LibraryPlan; onChange: (next: Partial<LibraryPlan>) => void; onBrowse: () => void; onRemove: () => void }) {
  const { t } = useTranslation("setupWizard");
  const nameId = useId();
  const typeId = useId();
  const nameInvalid = plan.name !== "" && !isValidLibraryName(plan.name.trim());
  const folder = plan.paths[0];
  return (
    <div className="space-y-3 rounded-xl border border-line-subtle bg-fill-faint p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <div>
          <label htmlFor={nameId} className={cls.lbl}>{t("libraryName")}</label>
          <input id={nameId} value={plan.name} onChange={(e) => onChange({ name: e.target.value })} aria-invalid={nameInvalid || undefined} className={`${cls.inp} aria-[invalid=true]:border-status-error`} />
        </div>
        <div>
          <label htmlFor={typeId} className={cls.lbl}>{t("libraryType")}</label>
          <select id={typeId} value={plan.type} onChange={(e) => onChange({ type: e.target.value as LibraryType })} className={`${cls.inp} cursor-pointer`}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`type_${type}`)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onRemove} aria-label={t("libraryRemove", { name: plan.name || "…" })} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-content-tertiary hover:bg-fill-subtle hover:text-status-error-fg">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {nameInvalid ? <p className="text-xs text-status-error-fg">{t("libraryNameInvalid")}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`min-w-0 flex-1 break-all font-mono text-xs ${folder ? "text-content-secondary" : "text-status-warning-fg"}`}>{folder ?? t("libraryFolderNone")}</span>
        <button type="button" onClick={onBrowse} className={folder ? cls.bs : cls.bbrand}>
          <FolderOpen size={16} aria-hidden="true" />
          {folder ? t("libraryBrowse") : t("libraryChooseFolder")}
        </button>
      </div>
    </div>
  );
}
