import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CircleHelp, X } from "lucide-react";
import { useFicheTrailerHint } from "@tentacle-tv/api-client";
import { trailerGuideHref, type MediaItem } from "@tentacle-tv/shared";

/**
 * « Vous ne voyez pas les bandes-annonces ? » au téléphone (miroir), à la
 * place de la pilule « Bande-annonce » quand le titre n'en a AUCUNE et que le
 * serveur est mal réglé (`useFicheTrailerHint`) : une ligne de texte centrée
 * sous « Lecture », qui mène au guide, et une croix pour ne plus la voir —
 * suivie six secondes d'un « Annuler ». Cibles de 44, comme partout au doigt.
 */
export const TrailerHintMirror = memo(function TrailerHintMirror({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("trailerHelp");
  const { phase, hide, undo } = useFicheTrailerHint(item, i18n.language);
  if (phase === "none") return null;

  return (
    <div aria-live="polite" className="flex min-h-[44px] items-center justify-center gap-0.5 text-[13px] text-content-secondary">
      {phase === "hint" ? (
        <>
          <Link to={trailerGuideHref()} className="mirror-detail-fade-press flex min-h-[44px] items-center gap-2 px-1">
            <CircleHelp size={15} strokeWidth={2} aria-hidden />
            <span className="underline decoration-line-strong underline-offset-4">{t("hintLink")}</span>
          </Link>
          <button
            type="button"
            onClick={hide}
            aria-label={t("hintHide")}
            className="mirror-detail-fade-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-content-tertiary"
          >
            <X size={16} aria-hidden />
          </button>
        </>
      ) : (
        <p className="flex flex-wrap items-center justify-center gap-x-2 px-2 text-center">
          <span>{t("hintHidden")}</span>
          <button type="button" onClick={undo} className="mirror-detail-fade-press min-h-[44px] font-semibold text-content-primary underline underline-offset-4">
            {t("hintUndo")}
          </button>
        </p>
      )}
    </div>
  );
});
