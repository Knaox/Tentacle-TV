import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { HorizontalScrollRow } from "../../components/HorizontalScrollRow";
import { RowHeader } from "../../components/rows/RowHeader";
import { OfflineEpisodeCard } from "../OfflineEpisodeCard";
import { useOfflineWatchedToggle } from "../detail/useOfflineActions";

/**
 * Une rangée de vignettes 16:9 de l'accueil local — « Reprendre la lecture »,
 * « À suivre » —, dans la grammaire des rangées en ligne : titre au rail de
 * marque, défilement horizontal aux chevrons montés au survol. Le catalogue
 * local est borné et ces rangées plafonnées (douze titres) : pas de fenêtrage.
 */
export function OfflineCardRow({ title, entries }: { title: string; entries: readonly DownloadListEntry[] }) {
  const navigate = useNavigate();
  const toggleWatched = useOfflineWatchedToggle();
  const play = useCallback((entry: DownloadListEntry) => navigate(`/watch/${entry.itemId}`), [navigate]);
  const open = useCallback((entry: DownloadListEntry) => navigate(`/offline/item/${entry.itemId}`), [navigate]);
  const toggle = useCallback(
    (entry: DownloadListEntry) => void toggleWatched([entry.itemId], !entry.played),
    [toggleWatched],
  );
  if (entries.length === 0) return null;

  return (
    <section className="group/row" aria-label={title}>
      <RowHeader title={title} />
      <HorizontalScrollRow ariaLabel={title} wrapperClassName="mt-1" className="row-gutter gap-3 pb-4 pt-6">
        {entries.map((entry) => (
          <div key={entry.id} className="w-[17rem] shrink-0 md:w-[19rem] xl:w-[21rem]">
            <OfflineEpisodeCard entry={entry} showHeading onPlay={play} onOpen={open} onToggleWatched={toggle} />
          </div>
        ))}
      </HorizontalScrollRow>
    </section>
  );
}
