import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import type { LibraryPlan, LibraryType } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { FolderBrowser } from "./FolderBrowser";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { defaultLibraries, isValidLibraryName } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

const TYPES: readonly LibraryType[] = ["movies", "tvshows", "mixed"];

/**
 * Jellyfin NEUF seulement (le parcours `fresh`) : de VRAIES bibliothèques
 * Jellyfin, créées par son API (`/Library/VirtualFolders`) à l'installation —
 * celles qui existent déjà sont lues, celles à créer proposées d'office dans
 * la pile complète (les dossiers que son service `init` a préparés).
 */
export function LibrariesScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const [plans, setPlans] = useState<LibraryPlan[]>(wizard.data.plans);
  const [loaded, setLoaded] = useState(wizard.data.existing.length > 0 || wizard.data.plans.length > 0);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [browsing, setBrowsing] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { patch } = wizard;
  const context = wizard.data.context;
  const existing = wizard.data.existing;

  useEffect(() => {
    if (loaded) return;
    setupApi
      .libraries()
      .then((found) => {
        patch({ existing: found });
        const inStack = context?.flow.selection?.inStack ?? false;
        setPlans(defaultLibraries(context, found, { movies: t("libraryDefaultMovies"), tvshows: t("libraryDefaultShows") }, inStack));
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof SetupApiError ? err.code : "internal"));
  }, [loaded, attempt, context, patch, t]);

  const update = (index: number, next: Partial<LibraryPlan>) => setPlans((all) => all.map((plan, i) => (i === index ? { ...plan, ...next } : plan)));
  const valid = plans.every((plan) => isValidLibraryName(plan.name.trim()) && plan.paths.length > 0);

  const proceed = () => {
    patch({ plans: plans.map((plan) => ({ ...plan, name: plan.name.trim() })) });
    wizard.next();
  };

  return (
    <WizardFrame title={t("librariesTitle")} subtitle={t("librariesSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back} server={wizard.server}>
      <div className="space-y-5">
        <SetupErrorLine
          code={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
        {existing.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-content-tertiary">{t("librariesExisting")}</p>
            <ul className="mt-2 space-y-1.5">
              {existing.map((library) => (
                <li key={library.name} className="text-sm text-content-secondary">
                  <span className="font-semibold text-content-primary">{library.name}</span>{" "}
                  <span className="break-all font-mono text-xs text-content-tertiary">{library.paths.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs font-medium text-content-tertiary">{t("librariesNew")}</p>
          {loaded && plans.length === 0 ? <p className="text-sm text-content-tertiary">{t("librariesNone")}</p> : null}
          {plans.map((plan, index) =>
            browsing === index ? (
              <FolderBrowser
                key={index}
                start={plan.paths[0] ?? context?.mediaFolders?.root ?? null}
                onPick={(path) => {
                  update(index, { paths: [path] });
                  setBrowsing(null);
                }}
                onCancel={() => setBrowsing(null)}
              />
            ) : (
              <PlanRow key={index} plan={plan} onChange={(next) => update(index, next)} onBrowse={() => setBrowsing(index)} onRemove={() => setPlans((all) => all.filter((_, i) => i !== index))} />
            ),
          )}
          <button
            type="button"
            onClick={() => setPlans((all) => [...all, { name: "", type: "movies", paths: [] }])}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary"
          >
            <Plus size={16} aria-hidden="true" />
            {t("libraryAdd")}
          </button>
        </div>

        <button type="button" onClick={proceed} disabled={!loaded || !valid} className={`${cls.bp} w-full sm:w-auto`}>
          {t("next")}
        </button>
      </div>
    </WizardFrame>
  );
}

function PlanRow({ plan, onChange, onBrowse, onRemove }: { plan: LibraryPlan; onChange: (next: Partial<LibraryPlan>) => void; onBrowse: () => void; onRemove: () => void }) {
  const { t } = useTranslation("setupWizard");
  const nameId = useId();
  const typeId = useId();
  const nameInvalid = plan.name !== "" && !isValidLibraryName(plan.name.trim());
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
        <span className="min-w-0 flex-1 break-all font-mono text-xs text-content-secondary">{plan.paths[0] ?? t("libraryFolderNone")}</span>
        <button type="button" onClick={onBrowse} className={cls.bs}>
          <FolderOpen size={16} aria-hidden="true" />
          {t("libraryBrowse")}
        </button>
      </div>
    </div>
  );
}
