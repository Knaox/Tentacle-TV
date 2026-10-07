import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, ExternalLink, Folder, ScanSearch, Tv } from "lucide-react";
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
 * ordonnée, numérotée : lue dans l'ordre par un lecteur d'écran, en deux
 * colonnes dans la carte, en une sur un téléphone.
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
      <ol aria-label={t("addSchemaLabel")} className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex min-w-0 items-center gap-3 rounded-xl border border-line-subtle bg-fill-faint px-3 py-2.5">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-subtle text-xs font-semibold tabular-nums text-content-secondary">
              {index + 1}
            </span>
            <step.icon size={20} aria-hidden="true" className="shrink-0 text-[var(--brand)]" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-content-primary">{t(step.title)}</span>
              <span className="block text-xs text-content-tertiary">{t(step.body)}</span>
            </span>
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
