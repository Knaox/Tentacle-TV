import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import {
  REMOTE_ACCESS_DOCS,
  REMOTE_ACCESS_GUIDE,
  REMOTE_ACCESS_GUIDE_ANCHOR,
  packagedHelpKeys,
  remoteAccessDocLabelKey,
  type SetupPackaging,
} from "@tentacle-tv/shared";
import { AdminSection } from "../admin/kit";

/**
 * Le guide de l'accès à distance, au pied de la section (`#guide`) : la
 * structure vient du modèle partagé (`help/remoteAccessGuide.ts`), les mots
 * de l'espace `remoteAccessHelp`. Une colonne de lecture bornée. L'app
 * Windows a ses phrases (`packagedHelp.ts`) : rien sur Docker Desktop.
 */
export function RemoteAccessGuide({ packaging }: { packaging?: SetupPackaging }) {
  const { t } = useTranslation("remoteAccessHelp");
  return (
    <AdminSection id={REMOTE_ACCESS_GUIDE_ANCHOR} title={t("guideTitle")} description={t("guideIntro")}>
      <div className="max-w-3xl space-y-8">
        {REMOTE_ACCESS_GUIDE.map((section) => (
          <section key={section.id} aria-labelledby={`guide-${section.id}`}>
            <h3 id={`guide-${section.id}`} className="text-[0.9375rem] font-semibold text-content-primary">
              {t(section.titleKey)}
            </h3>
            <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-content-secondary">
              {packagedHelpKeys("remoteAccessHelp", section.paragraphKeys, packaging).map((key) => (
                <p key={key}>{t(key)}</p>
              ))}
            </div>
            {section.links.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-content-tertiary">{t("linksLabel")}</p>
                <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {section.links.map((doc) => (
                    <li key={doc}>
                      <a
                        href={REMOTE_ACCESS_DOCS[doc]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-content-primary underline underline-offset-4 hover:opacity-80"
                      >
                        {t(remoteAccessDocLabelKey(doc))}
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </AdminSection>
  );
}
