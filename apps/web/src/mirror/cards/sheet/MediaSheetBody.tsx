import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCardRatingTarget, useJellyfinClient, useMediaItem, useSeriesWatchState } from "@tentacle-tv/api-client";
import { resolveCardOverlay } from "@tentacle-tv/shared";
import type { MediaSheetTarget } from "../cardSheet";
import { SheetActions } from "./SheetActions";
import { mediaSheetHeader, SheetHeader } from "./SheetHeader";
import { SheetPlayButton } from "./SheetPlayButton";
import { SheetRating } from "./SheetRating";
import { sheetPlayPlan } from "./sheetPlay";

/** Ce qui se note : un film, une série, un épisode (par sa série). */
const RATEABLE_TYPES: ReadonlySet<string> = new Set(["Movie", "Series", "Episode"]);

/**
 * La feuille d'un titre de la bibliothèque — le survol web (`CardHoverOverlay`)
 * rendu au doigt : ce qu'elle offre et dans quel ordre vient du modèle
 * partagé (`resolveCardOverlay`), les états de `useCardToggles`, la cible des
 * étoiles de `useCardRatingTarget` — la même logique que le bureau.
 *
 * L'item de la carte s'affiche tout de suite ; la fiche complète (`["item",
 * id]`, que les bascules patchent en optimiste) le remplace dès qu'elle
 * arrive — c'est elle qui porte l'identité tmdb d'un résultat de recherche,
 * et l'état à jour d'un film qu'on vient de basculer.
 */
export function MediaSheetBody({ target, onClose }: { target: MediaSheetTarget; onClose: () => void }) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { t: tm } = useTranslation("media");
  const { variant } = target;
  const { data: full, isPending } = useMediaItem(target.item.Id);
  const item = full ?? target.item;

  // L'affiche d'un épisode montre sa série : le bandeau aussi.
  const showsSeries = variant === "poster" && item.Type === "Episode" && !!item.SeriesId;
  const { data: series } = useMediaItem(showsSeries ? item.SeriesId : undefined);
  const { data: watchState } = useSeriesWatchState(item.Type === "Series" ? item.Id : undefined);
  const plan = sheetPlayPlan(item, watchState);
  // La note de ce que la carte MONTRE : la série sur une affiche, l'épisode sur une vignette.
  const rating = useCardRatingTarget(item, { scope: variant === "landscape" ? "item" : "series", enabled: true });

  const overlay = resolveCardOverlay({
    variant,
    inLibrary: true,
    playable: plan !== null,
    resume: plan?.resume,
    // Tant que la fiche complète n'est pas là, un titre notable garde la
    // place de ses étoiles : elles n'apparaissent pas après coup.
    rateable: rating.identity !== null || rating.pending || (isPending && RATEABLE_TYPES.has(item.Type)),
    offline: false,
  });

  // Toute navigation ferme d'abord : une fiche similaire garde le même écran.
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <>
      <SheetHeader {...mediaSheetHeader(item, series, showsSeries, (id, type, opts) => client.getImageUrl(id, type, opts), tm)} />
      {overlay.play && plan && (
        <SheetPlayButton
          plan={plan}
          title={item.Name}
          onPress={() => go(plan.targetId ? `/watch/${plan.targetId}` : `/media/${item.Id}`)}
        />
      )}
      <SheetActions item={item} overlay={overlay} onOpenDetails={() => go(`/media/${item.Id}`)} />
      {overlay.rate && <SheetRating identity={rating.identity} jellyfinItemId={rating.jellyfinItemId} />}
    </>
  );
}
