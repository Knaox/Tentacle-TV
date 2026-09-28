import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Info, Trash2 } from "lucide-react";
import { DetailPlayPill } from "../../components/detail/DetailPlayButton";
import { CapsuleButton, DetailCapsule } from "../../components/detail/DetailActionCapsule";
import { WatchedGlyph } from "../../components/cards/cardGlyphs";
import { fadeUp } from "../../theme/motion";

export interface OfflinePlayAction {
  label: string;
  /** « Reste 42 min », ou rien. */
  remaining: string | null;
  /** Avancement 0..1 dans l'anneau, `null` sans reprise. */
  progress: number | null;
  /** Ce que lance le bouton (le titre, ou l'épisode visé d'une série). */
  itemId: string;
  name: string;
}

interface Props {
  play: OfflinePlayAction | null;
  watched: boolean;
  onToggleWatched: () => void;
  /** La fiche en ligne du même titre — `null` hors ligne, où elle ne s'ouvrirait pas. */
  onlineItemId: string | null;
  onRemove: () => void;
  removeLabel: string;
}

/**
 * La rangée d'actions de la scène d'un titre gardé, dans la grammaire de la
 * fiche en ligne : Lecture au dégradé de marque (seule action en couleur),
 * puis UNE capsule — la coche « vu », la fiche complète quand le serveur
 * répond, et le retrait de la machine (confirmé ensuite).
 */
export function OfflineStageActions({ play, watched, onToggleWatched, onlineItemId, onRemove, removeLabel }: Props) {
  const { t } = useTranslation(["common", "cards"]);
  const navigate = useNavigate();
  return (
    <motion.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
      {play && (
        <DetailPlayPill
          label={play.label}
          remaining={play.remaining}
          progress={play.progress}
          ariaLabel={`${play.label} — ${play.name}`}
          onClick={() => navigate(`/watch/${play.itemId}`)}
        />
      )}
      <DetailCapsule>
        <CapsuleButton
          active={watched}
          onClick={onToggleWatched}
          label={watched ? t("cards:markUnwatched") : t("cards:markWatched")}
        >
          <WatchedGlyph filled={watched} className="h-5 w-5" />
        </CapsuleButton>
        {onlineItemId && (
          <CapsuleButton active={false} onClick={() => navigate(`/media/${onlineItemId}`)} label={t("common:fullDetails")}>
            <Info aria-hidden className="h-5 w-5" strokeWidth={1.8} />
          </CapsuleButton>
        )}
        <CapsuleButton active={false} onClick={onRemove} label={removeLabel}>
          <Trash2 aria-hidden className="h-5 w-5" strokeWidth={1.8} />
        </CapsuleButton>
      </DetailCapsule>
    </motion.div>
  );
}
