import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CircleHelp, X } from "lucide-react";
import { useFicheTrailerHint } from "@tentacle-tv/api-client";
import { trailerGuideHref, type MediaItem } from "@tentacle-tv/shared";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]";

/**
 * « Vous ne voyez pas les bandes-annonces ? » — le rappel discret de la fiche
 * d'un titre qui n'en a AUCUNE, quand le serveur est mal réglé (règle et
 * gestes : `useFicheTrailerHint`). Pas une bannière : une ligne de texte à la
 * taille de « Afficher plus », qui mène au guide, et une croix pour ne plus
 * jamais la voir — suivie quelques secondes d'un « Annuler » à la même place.
 *
 * En BOUT de la rangée d'actions, en ligne : elle paraît quand les listes
 * arrivent sans rien pousser — ni « Lecture », ni la capsule, ni la scène,
 * ancrée par le bas. Sous la rangée, elle tombait dans la marge basse de la
 * scène, que la barre de titre du bureau fait passer sous la fenêtre.
 *
 * ⚠️ Substituée sur webOS (`TrailerHelpHintTv`) : une phrase sans lien.
 */
export const TrailerHelpHint = memo(function TrailerHelpHint({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("trailerHelp");
  const { phase, hide, undo } = useFicheTrailerHint(item, i18n.language);
  if (phase === "none") return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      aria-live="polite"
      className="flex items-center gap-1 text-[0.8125rem] font-medium text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]"
    >
      {phase === "hint" ? (
        <>
          <Link
            to={trailerGuideHref()}
            className={`group inline-flex min-h-[2rem] items-center gap-2 rounded-md transition-colors duration-150 hover:text-on-media-primary ${FOCUS}`}
          >
            <CircleHelp size={15} aria-hidden />
            <span className="underline decoration-[rgba(255,255,255,0.35)] underline-offset-4 transition-colors duration-150 group-hover:decoration-current">
              {t("hintLink")}
            </span>
          </Link>
          <button
            type="button"
            onClick={hide}
            aria-label={t("hintHide")}
            title={t("hintHide")}
            className={`flex h-8 w-8 items-center justify-center rounded-full opacity-75 transition duration-150 hover:bg-[rgba(255,255,255,0.12)] hover:text-on-media-primary hover:opacity-100 ${FOCUS}`}
          >
            <X size={14} aria-hidden />
          </button>
        </>
      ) : (
        <p className="flex items-center gap-2">
          <span>{t("hintHidden")}</span>
          <button
            type="button"
            onClick={undo}
            className={`min-h-[2rem] rounded-md font-semibold text-on-media-primary underline underline-offset-4 ${FOCUS}`}
          >
            {t("hintUndo")}
          </button>
        </p>
      )}
    </motion.div>
  );
});
