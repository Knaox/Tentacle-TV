import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { keptBytes, type OfflineSeasonGroup } from "@tentacle-tv/offline-core";
import type { DownloadEntry } from "../api";
import { OfflineEpisodeCard } from "../OfflineEpisodeCard";
import { SeasonPicker } from "../SeasonPicker";
import { formatBytes } from "../presets";
import { RowHeader } from "../../components/rows/RowHeader";
import { RevealCell, RevealScope } from "../../components/grid/RevealCell";
import { useOfflineWatchedToggle } from "./useOfflineActions";

/** Vignette 16:9 plus son bloc titre — hauteur réservée avant premier passage. */
const EPISODE_CELL_HEIGHT = 230;
const EPISODE_TEXT_HEIGHT = 24;

interface Props {
  title: string;
  episodes: readonly DownloadEntry[];
  /** L'épisode de la fiche, ou celui que « Lecture » vise : cerclé. */
  currentId?: string;
  /** Série : ses saisons, et celle qu'on regarde. Absent = une seule liste. */
  seasons?: { all: OfflineSeasonGroup[]; activeKey: string; onSelect: (key: string) => void };
}

/**
 * Les épisodes gardés sur la machine, en grille de vignettes 16:9 — l'image
 * EXACTE de la reprise pour un épisode entamé, tirée des planches déjà sur le
 * disque. Comme toute vignette : le clic lance la lecture, la fiche de
 * l'épisode passe par le plateau du survol, avec la coche « vu ».
 *
 * Une saison peut compter plus de cent épisodes : les cellules gardent leur
 * place, seul leur contenu est démonté hors du champ.
 */
export function OfflineEpisodesSection({ title, episodes, currentId, seasons }: Props) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const toggleWatched = useOfflineWatchedToggle();
  const open = useCallback((entry: DownloadEntry) => navigate(`/offline/item/${entry.itemId}`), [navigate]);
  const play = useCallback((entry: DownloadEntry) => navigate(`/watch/${entry.itemId}`), [navigate]);
  const toggle = useCallback((entry: DownloadEntry) => void toggleWatched([entry.itemId], !entry.played), [toggleWatched]);
  if (episodes.length === 0) return null;
  const summary = `${t("episodesCount", { count: episodes.length })} · ${formatBytes(keptBytes(episodes))}`;

  return (
    <section className="group/row" aria-label={title}>
      <RowHeader
        title={title}
        trailing={<span className="text-sm font-medium tabular-nums text-content-tertiary">{summary}</span>}
      />
      <div className="row-gutter mt-4">
        {seasons && <SeasonPicker seasons={seasons.all} activeKey={seasons.activeKey} onSelect={seasons.onSelect} />}
        <RevealScope>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {episodes.map((episode, index) => {
              const current = episode.itemId === currentId;
              return (
                <li key={episode.id} aria-current={current ? "true" : undefined}>
                  <RevealCell
                    minHeight={EPISODE_CELL_HEIGHT}
                    aspect={16 / 9}
                    textHeight={EPISODE_TEXT_HEIGHT}
                    eager={index < 8}
                    className={current ? "rounded-lg ring-2 ring-[rgba(var(--brand-rgb),0.75)] ring-offset-4 ring-offset-surface-0" : undefined}
                  >
                    <OfflineEpisodeCard entry={episode} onPlay={play} onOpen={open} onToggleWatched={toggle} />
                  </RevealCell>
                </li>
              );
            })}
          </ul>
        </RevealScope>
      </div>
    </section>
  );
}
