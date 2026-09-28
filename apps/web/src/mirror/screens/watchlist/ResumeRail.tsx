import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Play } from "lucide-react";
import { useJellyfinClient, watchProgress } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { CardMarkerLayer } from "../../../components/cards/CardMarkerLayer";
import { useRemainingLabel } from "../../../components/watchlist/WatchProgressLine";
import { Pressable } from "../../ui/Pressable";
import { ProgressBar } from "../../ui/ProgressBar";

/**
 * « Reprendre » : vignettes 16:9 de 220, rayon 12, qui défilent à l'horizontale.
 * Toucher lance la lecture — c'est la seule promesse de la rangée ; l'appui
 * long ouvre la feuille de la vignette (variante `landscape` : la fiche y a
 * son entrée). Les marqueurs de toutes les cartes au repos, comme la tuile du
 * bureau : la note en haut à gauche — le bas porte déjà la lecture et la
 * progression —, la pastille d'états en face.
 */
export const ResumeRail = memo(function ResumeRail({
  items, onPlay, onLongPress, pendingId,
}: {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onLongPress?: (item: MediaItem) => void;
  pendingId: string | null;
}) {
  const { t } = useTranslation("watchlist");
  const client = useJellyfinClient();
  const remainingLabel = useRemainingLabel();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="mirror-resume-title" className="pb-4">
      <h2 id="mirror-resume-title" className="px-4 pb-2 text-[17px] font-bold tracking-[-0.3px] text-content-primary">
        {t("resumeTitle")}
      </h2>
      <div className="mirror-no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4">
        {items.map((item) => {
          const hasBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
          const image = client.getImageUrl(item.Id, hasBackdrop ? "Backdrop" : "Primary", { width: 480, quality: 75 });
          const remaining = remainingLabel(item);
          const percent = watchProgress(item);
          const pending = pendingId === item.Id;
          return (
            <Pressable
              key={item.Id}
              onPress={() => onPlay(item)}
              onLongPress={onLongPress ? () => onLongPress(item) : undefined}
              disabled={pending}
              aria-label={`${t("resume")} — ${item.Name}${remaining ? `, ${remaining}` : ""}`}
              className="w-[220px] shrink-0 snap-start text-left"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl border border-line-subtle bg-surface-2">
                <img src={image} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <CardMarkerLayer
                  item={item}
                  communityRating={cardRatingFor(item, "series").rating}
                  ratingClassName="left-2 top-2"
                  statusClassName="right-2 top-2"
                />
                <span aria-hidden className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black">
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                </span>
                {percent != null && percent < 100 && (
                  <div className="absolute inset-x-0 bottom-0">
                    <ProgressBar progress={percent / 100} />
                  </div>
                )}
              </div>
              <p className="mt-1.5 truncate text-[13px] font-semibold text-content-primary">{item.Name}</p>
              {remaining && <p className="truncate text-[11px] text-content-tertiary">{remaining}</p>}
            </Pressable>
          );
        })}
      </div>
    </section>
  );
});
