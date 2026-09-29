import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2 } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActionsRow } from "./DetailActionsRow";
import { PlayCtaButton } from "./PlayCtaButton";
import { StageBlock } from "./StageBlock";
import { TrailerPill } from "./TrailerPill";
import { playCta, PLAY_MAX_WIDTH, type DetailGeometry } from "./detailMetrics";

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

interface Props {
  item: MediaItem;
  geo: DetailGeometry;
  seriesWatchState: SeriesWatchState;
  /** Ouvre la vue « image plein écran » sur l'affiche (iPad paysage). */
  onOpenPoster?: () => void;
}

/**
 * `DetailHeader` de l'app.
 *
 * Portrait : le bloc titre vit DANS la scène (cf. `index.tsx`) ; ici, sous le
 * décor, le bouton Lecture, la bande-annonce s'il y en a une, puis la rangée
 * d'actions, centrés sur 420.
 * iPad paysage (`twoCol`) : la colonne gauche figée — affiche (qui ouvre la
 * vue plein écran), bloc titre aligné à gauche, Lecture, bande-annonce, actions.
 */
export const DetailHeader = memo(function DetailHeader({ item, geo, seriesWatchState, onOpenPoster }: Props) {
  const { t } = useTranslation("common");
  const { t: tm } = useTranslation("media");
  const client = useJellyfinClient();
  const [posterBroken, setPosterBroken] = useState(false);
  const cta = playCta(item, seriesWatchState, t);

  const playEl = (
    <>
      {cta.targetId && (
        <div className="mirror-detail-in-actions mt-5 flex justify-center">
          <PlayCtaButton cta={cta} title={item.Name} maxWidth={PLAY_MAX_WIDTH} />
        </div>
      )}
      {/* Sous Lecture, 12 d'écart ; seule, 20 comme Lecture elle-même. */}
      <div className={`mirror-detail-in-actions flex justify-center empty:hidden ${cta.targetId ? "mt-3" : "mt-5"}`}>
        <TrailerPill item={item} maxWidth={PLAY_MAX_WIDTH} />
      </div>
    </>
  );
  const actionsEl = (
    // Largeur de la rangée de l'app (420 + 2 × 16), centrée sous Lecture.
    <div className="mirror-detail-in-actions mx-auto w-full" style={{ maxWidth: PLAY_MAX_WIDTH + 32 }}>
      <DetailActionsRow item={item} />
    </div>
  );

  if (!geo.twoCol) {
    return (
      <>
        <div className="px-4">{playEl}</div>
        {actionsEl}
      </>
    );
  }

  const isEpisode = item.Type === "Episode";
  const posterId = isEpisode ? (item.SeriesId ?? item.Id) : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { height: 500, quality: 90 });
  return (
    <div className="px-4">
      <button
        type="button"
        onClick={onOpenPoster}
        disabled={!onOpenPoster}
        aria-label={tm("detailOpenPoster")}
        className="mirror-detail-in-poster mirror-detail-fade-press group relative block shrink-0 overflow-hidden rounded-xl bg-surface-2"
        style={{ width: geo.posterW, height: geo.posterH, boxShadow: "0 18px 36px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--brand-rgb),0.12)" }}
      >
        {!posterBroken && (
          <img src={poster} alt="" decoding="async" draggable={false} onError={() => setPosterBroken(true)} className="h-full w-full object-cover" />
        )}
        <span aria-hidden className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
          <Maximize2 size={13} />
        </span>
      </button>
      <div className="mt-4">
        <StageBlock item={item} align="start" logoMaxW={340} logoMaxH={110} />
      </div>
      {playEl}
      {actionsEl}
    </div>
  );
});
