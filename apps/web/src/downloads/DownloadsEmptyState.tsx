/**
 * L'état vide de l'écran des téléchargements.
 *
 * Il disait « Aucun téléchargement » et un lien : rien sur le COMMENT. Trois
 * étapes numérotées disent le geste, depuis la fiche jusqu'à la lecture sans
 * réseau — l'utilisateur qui arrive ici n'a, par définition, jamais essayé.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DownloadSimpleIcon as HardDriveDownload } from "@phosphor-icons/react/dist/csr/DownloadSimple";

const STEPS = ["emptyStep1", "emptyStep2", "emptyStep3"] as const;

export function DownloadsEmptyState() {
  const { t } = useTranslation("downloads");
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-surface-2 text-content-secondary">
          <HardDriveDownload size={26} aria-hidden />
        </span>
        <p className="font-display text-heading-3 text-content-primary">{t("emptyTitle")}</p>
        <p className="max-w-[52ch] text-sm leading-relaxed text-content-secondary">{t("emptyMessage")}</p>
      </div>

      <ol className="grid w-full max-w-3xl gap-2.5 text-left sm:grid-cols-3">
        {STEPS.map((key, index) => (
          <li key={key} className="flex items-start gap-3 rounded-tile bg-surface-1 p-3.5 shadow-edge">
            <span className="num flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-pill bg-fill-soft text-xs font-bold text-content-primary">
              {index + 1}
            </span>
            <span className="text-sm leading-snug text-content-secondary">{t(key)}</span>
          </li>
        ))}
      </ol>

      {/* Un état vide qui ne propose rien laisse l'utilisateur sur place. */}
      <Link to="/" className="btn btn-solid">
        {t("emptyAction")}
      </Link>
    </div>
  );
}
