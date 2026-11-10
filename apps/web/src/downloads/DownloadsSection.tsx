/**
 * Une section de l'écran des téléchargements (En cours, Films, une série) :
 * titre, compte et espace occupé, et un repli.
 *
 * Replier, parce qu'une série de trois saisons empilait soixante lignes entre
 * les films et la série suivante. L'état replié ne vit que le temps de la
 * visite : il n'y a rien à retenir d'une session à l'autre.
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CaretDownIcon as ChevronDown } from "@phosphor-icons/react/dist/csr/CaretDown";

interface Props {
  title: string;
  /** « 12 épisodes · 18,4 Gio » — l'appelant compose. */
  summary?: string;
  /** Posée DANS un panneau qui a déjà sa peau (la file) : l'en-tête et les lignes, sans panneau à elle. */
  bare?: boolean;
  children: ReactNode;
}

export function DownloadsSection({ title, summary, bare = false, children }: Props) {
  const { t } = useTranslation("downloads");
  const [open, setOpen] = useState(true);
  const Frame = bare ? "div" : "section";
  return (
    <Frame className={bare ? "border-t border-line-subtle" : "ui-panel lg-panel overflow-hidden"}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={t(open ? "sectionCollapse" : "sectionExpand", { title })}
        className={`group flex w-full items-center gap-3 px-5 text-left transition-colors duration-hover hover:bg-fill-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--border-focus)] ${bare ? "py-2.5" : "py-4"}`}
      >
        {bare ? (
          <span className="ui-eyebrow min-w-0 truncate">{title}</span>
        ) : (
          <h2 className="min-w-0 truncate font-display text-[18px] font-semibold leading-tight tracking-[-0.015em] text-content-primary">{title}</h2>
        )}
        {summary && <span className="num flex-shrink-0 text-xs text-content-tertiary">{summary}</span>}
        <span className="flex-1" aria-hidden />
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 text-content-tertiary transition-transform duration-hover ease-out ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {/* Des lignes de panneau : un filet entre elles, plus une carte bordée par titre. */}
      {open && <div className="divide-y divide-line-subtle border-t border-line-subtle">{children}</div>}
    </Frame>
  );
}
