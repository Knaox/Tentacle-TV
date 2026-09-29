import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TRAILER_GUIDE_NOTES, TRAILER_GUIDE_SOURCES } from "@tentacle-tv/shared";
import { GUIDE_ICONS } from "./guideIcons";
import { GUIDE_PARAGRAPH } from "./GuideStep";

/** Un bloc de la partie « Pour tous » : un intertitre, puis son contenu. */
function GuideBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-content-primary">{title}</h3>
      {children}
    </div>
  );
}

/**
 * « Pour tous » : ce n'est pas vous, d'où viennent les bandes-annonces, qui
 * peut agir, et ce qu'il est bon de savoir. Écrit pour qui n'administre rien :
 * pas un réglage à faire soi-même, la marche à suivre est pour
 * l'administrateur — un administrateur qui lit ceci y est renvoyé d'un lien.
 */
export const GuideEveryone = memo(function GuideEveryone({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation("trailerHelp");

  return (
    <section id="everyone" aria-labelledby="guide-everyone-title" className="scroll-mt-24">
      <h2 id="guide-everyone-title" className="text-heading-1 text-content-primary">
        {t("partEveryone")}
      </h2>
      <div className="mt-6 space-y-9">
        <GuideBlock title={t("notYouTitle")}>
          <p className={GUIDE_PARAGRAPH}>{t("notYouBody")}</p>
        </GuideBlock>

        <GuideBlock title={t("sourcesTitle")}>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {TRAILER_GUIDE_SOURCES.map((source) => {
              const Icon = GUIDE_ICONS[source.icon];
              return (
                <li key={source.id} className="rounded-2xl border border-line-subtle bg-fill-faint p-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill-soft text-content-secondary">
                      <Icon size={18} />
                    </span>
                    <p className="text-[0.9375rem] font-semibold text-content-primary">{t(source.titleKey)}</p>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-content-secondary">{t(source.bodyKey)}</p>
                </li>
              );
            })}
          </ul>
        </GuideBlock>

        <GuideBlock title={t("whatToDoTitle")}>
          <p className={GUIDE_PARAGRAPH}>{t("whatToDoBody")}</p>
          {isAdmin && (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[rgba(var(--brand-rgb),0.1)] px-4 py-3 text-sm text-content-primary">
              <span>{t("whatToDoAdmin")}</span>
              <Link
                to={{ hash: "#admin" }}
                className="font-semibold underline decoration-[rgba(var(--brand-rgb),0.6)] underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                {t("whatToDoAdminLink")}
              </Link>
            </p>
          )}
        </GuideBlock>

        <GuideBlock title={t("notesTitle")}>
          <ul className="mt-3 space-y-3">
            {TRAILER_GUIDE_NOTES.map((note) => {
              const Icon = GUIDE_ICONS[note.icon];
              return (
                <li key={note.key} className="flex gap-3 text-[0.9375rem] leading-relaxed text-content-secondary">
                  <Icon size={18} aria-hidden className="mt-[3px] shrink-0 text-content-tertiary" />
                  <span>{t(note.key)}</span>
                </li>
              );
            })}
          </ul>
        </GuideBlock>
      </div>
    </section>
  );
});
