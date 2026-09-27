/**
 * L'état vide de l'écran des téléchargements.
 *
 * Il disait « Aucun téléchargement » et un lien : rien sur le COMMENT. Trois
 * étapes numérotées disent le geste, depuis la fiche jusqu'à la lecture sans
 * réseau — l'utilisateur qui arrive ici n'a, par définition, jamais essayé.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HardDriveDownload } from "lucide-react";

const STEPS = ["emptyStep1", "emptyStep2", "emptyStep3"] as const;

export function DownloadsEmptyState() {
  const { t } = useTranslation("downloads");
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg shadow-[0_10px_30px_rgba(var(--brand-rgb),0.35)]">
        <HardDriveDownload className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-5 text-lg font-semibold text-content-primary">{t("emptyTitle")}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-content-tertiary">{t("emptyMessage")}</p>

      <ol className="mt-6 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-3">
        {STEPS.map((key, index) => (
          <li key={key} className="flex items-start gap-3 rounded-xl border border-line-subtle bg-fill-faint p-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(var(--brand-rgb),0.18)] text-xs font-bold tabular-nums text-[var(--brand-light)]">
              {index + 1}
            </span>
            <span className="text-sm leading-snug text-content-secondary">{t(key)}</span>
          </li>
        ))}
      </ol>

      {/* Un état vide qui ne propose rien laisse l'utilisateur sur place. */}
      <Link
        to="/"
        className="mt-6 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-5 py-2 text-sm font-bold text-cta-brand-fg transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      >
        {t("emptyAction")}
      </Link>
    </div>
  );
}
