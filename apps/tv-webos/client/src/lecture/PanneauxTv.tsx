import { useTranslation } from "react-i18next";
import type { MediaItem, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { ApplyToSeriesControl } from "@/hooks/useApplyToSeries";
import { TrackSelector } from "@/components/TrackSelector";
import { EpisodeSelectorPanel } from "@/components/player/EpisodeSelectorPanel";

/**
 * Les deux panneaux du lecteur, habillés pour la télécommande.
 *
 * **On enveloppe, on ne recopie pas.** `TrackSelector` porte cent cinquante
 * lignes d'étiquetage — analyse des libellés de piste, table des langues,
 * pastilles Dolby Vision, HDR, Atmos, formatage des débits — qu'un panneau
 * autonome devrait dupliquer, donc laisser diverger. Ses options sont déjà de
 * vrais `<button>`, son fond est déjà opaque, et le shim de framer-motion en
 * fait un `<div>` nu. Trois choses seulement manquaient.
 *
 * **Le piège à focus.** Le panneau du web n'a pas de `role="dialog"` : le
 * recensement du moteur ne le reconnaissait donc pas comme conteneur piégeant,
 * et le D-pad s'échappait vers les boutons restés DERRIÈRE le panneau.
 * L'enveloppe le déclare, et le moteur y confine le focus.
 *
 * **La case « Appliquer à cette série ».** Elle est en `sr-only`, c'est-à-dire
 * un carré d'un pixel — que le recensement retient (il n'écarte que les
 * dimensions nulles) et où l'anneau de focus disparaît. On ne transmet donc pas
 * `applyToSeries` au panneau du web, et on rend la même préférence en dessous,
 * en bouton visible. Même motif que les pastilles d'indicateur de la bannière :
 * une cible de quatre pixels n'est pas une cible, c'est un obstacle.
 *
 * **La taille.** Traitée par la feuille, en descendance simple.
 */

interface ProprietesPanneauPistes {
  audioTracks: { index: number; label: string }[];
  subtitleTracks: { index: number; label: string }[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  qualityPresets?: readonly QualityPreset[];
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  applyToSeries?: ApplyToSeriesControl;
  onClose: () => void;
}

export function PanneauPistesTv({ applyToSeries, ...reste }: ProprietesPanneauPistes) {
  const { t } = useTranslation("player");

  return (
    <div className="panneau-tv" role="dialog" aria-label={t("player:tracks")}>
      <TrackSelector {...reste} />
      {applyToSeries && (
        <button
          type="button"
          role="switch"
          aria-checked={applyToSeries.checked}
          disabled={applyToSeries.pending}
          onClick={() => applyToSeries.toggle(!applyToSeries.checked)}
          className="panneau-tv-bascule"
          data-actif={applyToSeries.checked}
        >
          {t("player:applyToSeries")}
        </button>
      )}
    </div>
  );
}

interface ProprietesPanneauEpisodes {
  item: MediaItem;
  onClose: () => void;
}

export function PanneauEpisodesTv({ item, onClose }: ProprietesPanneauEpisodes) {
  const { t } = useTranslation("player");
  if (!item.SeriesId) return null;

  return (
    <div className="panneau-tv" role="dialog" aria-label={t("player:episodes")}>
      <EpisodeSelectorPanel
        seriesId={item.SeriesId}
        currentEpisodeId={item.Id}
        currentSeasonId={item.SeasonId}
        onClose={onClose}
      />
    </div>
  );
}
