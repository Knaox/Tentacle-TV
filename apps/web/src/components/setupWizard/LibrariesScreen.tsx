import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { LibraryPlan, PathStyle } from "@tentacle-tv/shared";
import { ExplorerPick } from "./ExplorerPick";
import { FolderBrowser } from "./FolderBrowser";
import { LibraryPlanRow } from "./LibraryPlanRow";
import { LocaleFields } from "./LocaleFields";
import { MediaFolderMap } from "./MediaFolderMap";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import { SetupWaiting } from "./SetupWaiting";
import type { Wizard } from "./useWizard";
import { defaultLibraries, isValidLibraryName, pathOf, plansMissingFolder } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

/**
 * De VRAIES bibliothèques Jellyfin, créées par son API
 * (`/Library/VirtualFolders`) à l'installation :
 *
 *  - Jellyfin NEUF (parcours `fresh`) : proposées d'office ;
 *  - Jellyfin DÉJÀ configuré mais trouvé SANS bibliothèque à la connexion :
 *    proposées, FACULTATIVES (« Passer ») — la langue des métadonnées est ici,
 *    puisque l'écran de connexion ne la demande pas.
 *
 * « Films » et « Séries » sont proposées : sur les dossiers de la pile pour son
 * Jellyfin, sinon sans dossier — on choisit les siens dans ce que voit
 * JELLYFIN (arborescence Linux ou lecteurs Windows, selon sa machine). Dans
 * l'app Windows, depuis le PC même, la boîte de l'Explorateur en plus. Où
 * déposer ses fichiers est dit à gauche, les bibliothèques à créer à droite.
 */
export function LibrariesScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const [plans, setPlans] = useState<LibraryPlan[]>(wizard.data.plans);
  const [loaded, setLoaded] = useState(wizard.data.existing.length > 0 || wizard.data.plans.length > 0);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [browsing, setBrowsing] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [style, setStyle] = useState<PathStyle>("posix");
  const { patch } = wizard;
  const context = wizard.data.context;
  const existing = wizard.data.existing;
  const inStack = context?.flow.selection?.inStack ?? false;
  const optional = pathOf(context) === "configured";
  // App Windows, navigateur sur le PC même : la boîte de l'Explorateur, en plus du parcours par Jellyfin.
  const explorer = context?.appHost?.pickFolder === true;

  useEffect(() => {
    if (loaded) return;
    setupApi
      .libraries()
      .then((found) => {
        patch({ existing: found });
        setPlans(defaultLibraries(context, found, { movies: t("libraryDefaultMovies"), tvshows: t("libraryDefaultShows") }, inStack));
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof SetupApiError ? err.code : "internal"));
  }, [loaded, attempt, context, inStack, patch, t]);

  // La machine de Jellyfin : ses lecteurs disent Linux ou Windows (un échec laisse Linux, l'écran reste utilisable).
  useEffect(() => {
    let cancelled = false;
    setupApi
      .browse()
      .then((root) => !cancelled && setStyle(root.style ?? "posix"))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (index: number, next: Partial<LibraryPlan>) => setPlans((all) => all.map((plan, i) => (i === index ? { ...plan, ...next } : plan)));
  const missing = plansMissingFolder(plans);
  const valid = plans.every((plan) => isValidLibraryName(plan.name.trim())) && missing.length === 0;

  const proceed = (chosen: LibraryPlan[]) => {
    patch({ plans: chosen.map((plan) => ({ ...plan, name: plan.name.trim() })), outcomes: null });
    wizard.next();
  };

  const aside = (
    <>
      <MediaFolderMap context={context} inStack={inStack} style={style} />
      {existing.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-content-tertiary">{t("librariesExisting")}</p>
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
    </>
  );
  const missingLine =
    loaded && missing.length > 0 ? (
      <span className="text-status-warning-fg">
        {missing.length === 1 && missing[0].name.trim() ? t("libraryFolderMissing", { name: missing[0].name.trim() }) : t("libraryFolderMissingUnnamed")}
      </span>
    ) : null;

  return (
    <WizardFrame
      wizard={wizard}
      title={optional ? t("librariesTitleEmpty") : t("librariesTitle")}
      subtitle={optional ? t("librariesSubtitleEmpty") : t("librariesSubtitle")}
      aside={aside}
      status={missingLine}
      primary={{ label: t("next"), onClick: () => proceed(plans), disabled: !loaded || !valid }}
      secondary={optional ? [{ label: t("librariesSkip"), onClick: () => proceed([]) }] : undefined}
    >
      <div className="space-y-5">
        <SetupErrorLine
          code={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
        {!loaded && !error ? <SetupWaiting title={t("loading")} /> : null}

        {loaded ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-content-tertiary">{missing.length > 0 ? t("librariesPick") : t("librariesNew")}</p>
            {plans.length === 0 ? <p className="text-sm text-content-tertiary">{t("librariesNone")}</p> : null}
            {plans.map((plan, index) =>
              browsing === index ? (
                <FolderBrowser
                  key={index}
                  start={plan.paths[0] ?? (inStack ? (context?.mediaFolders?.root ?? null) : null)}
                  onPick={(path) => {
                    update(index, { paths: [path] });
                    setBrowsing(null);
                  }}
                  onCancel={() => setBrowsing(null)}
                />
              ) : (
                <LibraryPlanRow
                  key={index}
                  plan={plan}
                  onChange={(next) => update(index, next)}
                  onBrowse={() => setBrowsing(index)}
                  onRemove={() => setPlans((all) => all.filter((_, i) => i !== index))}
                  explorer={
                    explorer ? (
                      <ExplorerPick name={plan.name} current={plan.paths[0] ?? null} primary={!plan.paths[0]} onPick={(path) => update(index, { paths: [path] })} />
                    ) : undefined
                  }
                />
              ),
            )}
            <button
              type="button"
              onClick={() => setPlans((all) => [...all, { name: "", type: "movies", paths: [] }])}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-subtle px-4 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-faint hover:text-content-primary"
            >
              <Plus size={16} aria-hidden="true" />
              {t("libraryAdd")}
            </button>
          </div>
        ) : null}

        {optional && plans.length > 0 ? (
          <div className="border-t border-line-subtle pt-5">
            <LocaleFields locale={wizard.data.locale} onChange={(locale) => patch({ locale })} />
          </div>
        ) : null}
      </div>
    </WizardFrame>
  );
}
