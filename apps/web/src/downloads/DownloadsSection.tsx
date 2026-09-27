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
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  /** « 12 épisodes · 18,4 Gio » — l'appelant compose. */
  summary?: string;
  children: ReactNode;
}

export function DownloadsSection({ title, summary, children }: Props) {
  const { t } = useTranslation("downloads");
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={t(open ? "sectionCollapse" : "sectionExpand", { title })}
        className="group mb-3 flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      >
        <h2 className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide text-content-tertiary group-hover:text-content-secondary">
          {title}
        </h2>
        {summary && <span className="flex-shrink-0 text-xs tabular-nums text-content-quaternary">{summary}</span>}
        <span className="h-px flex-1 bg-line-subtle" aria-hidden />
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 text-content-quaternary transition-transform duration-200 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}
