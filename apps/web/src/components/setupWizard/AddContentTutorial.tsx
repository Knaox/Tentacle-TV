import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Clapperboard, ExternalLink, Folder, ScanSearch, Tv } from "lucide-react";
import { setupDocUrl } from "@tentacle-tv/shared";
import type { ContentFolder } from "./addContentModel";

const STEPS = [
  { icon: Folder, title: "addStep1", body: "addStep1Body" },
  { icon: Clapperboard, title: "addStep2", body: "addStep2Body" },
  { icon: ScanSearch, title: "addStep3", body: "addStep3Body" },
  { icon: Tv, title: "addStep4", body: "addStep4Body" },
] as const;

/**
 * « Pour ajouter du contenu » : où déposer ses fichiers (les dossiers des
 * bibliothèques, dits du point de vue du serveur), un schéma en quatre temps
 * — dossier, film, analyse par Jellyfin, le titre dans Tentacle —, combien de
 * temps prend l'analyse et comment la relancer. Le schéma est une liste
 * ordonnée : lue dans l'ordre par un lecteur d'écran, en ligne sur un écran
 * large, en colonne sur un téléphone.
 */
export const AddContentTutorial = memo(function AddContentTutorial({ folders }: { folders: readonly ContentFolder[] }) {
  const { t, i18n } = useTranslation("setupWizard");
  return (
    <section aria-labelledby="add-content" className="space-y-4">
      <h2 id="add-content" className="font-semibold text-content-primary">{t("addTitle")}</h2>
      <p>{folders.length ? t("addLead") : t("addLeadNone")}</p>
      {folders.length ? (
        <ul className="space-y-1.5" data-testid="add-content-folders">
          {folders.map((folder) => (
            <li key={`${folder.name}-${folder.path}`} className="rounded-lg bg-fill-subtle px-3 py-2">
              <span className="font-semibold text-content-primary">{folder.name}</span>{" "}
              <span className="break-all font-mono text-xs text-content-primary">{folder.hostPath ?? folder.path}</span>
              {folder.hostPath ? (
                <span className="block text-xs text-content-tertiary">
                  {t("addOnServer")} · {t("addSeenByJellyfin", { path: folder.path })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ol aria-label={t("addSchemaLabel")} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-1 sm:flex-row sm:items-center">
            {index > 0 ? <ChevronRight size={16} aria-hidden="true" className="mx-auto shrink-0 rotate-90 text-content-quaternary sm:rotate-0" /> : null}
            <div className="flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-xl border border-line-subtle bg-fill-faint px-3 py-2.5 sm:flex-col sm:justify-center sm:text-center">
              <step.icon size={22} aria-hidden="true" className="shrink-0 text-[var(--brand)]" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-content-primary">{t(step.title)}</span>
                <span className="block text-xs text-content-tertiary">{t(step.body)}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p>{t("addNaming")}</p>
      <p>{t("addTiming")}</p>
      <p>{t("addRescan")}</p>
      <a href={setupDocUrl("addContent", i18n.language ?? "en")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-content-secondary underline underline-offset-4 hover:text-content-primary">
        {t("addGuide")}
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </section>
  );
});
