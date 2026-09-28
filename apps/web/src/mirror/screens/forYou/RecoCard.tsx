import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, useIsWatchlistPending, useJellyfinClient, useRecoMarkerItem, type RecoRowItem } from "@tentacle-tv/api-client";
import { titleKey } from "@tentacle-tv/shared";
import { CardMarkerLayer } from "../../../components/cards/CardMarkerLayer";
import { RecoOnDemandLabel } from "../../../components/reco/RecoOnDemandLabel";
import { Pressable } from "../../ui/Pressable";
import { useCardWidth } from "../../useMirrorLayout";

/**
 * `RecoCard` de l'app : l'affiche 2:3 (rayon 12, ombre elev2) d'une
 * recommandation, avec les MARQUEURS de toutes les cartes (`CardMarkerLayer`)
 * — la note globale et la vôtre en bas à gauche, la pastille Ma liste /
 * favori / vu en haut à droite, comme `MediaCard`. En haut à gauche, empilés :
 * « À la demande » (hors bibliothèque) et « Découverte » au dégradé. Titre 13
 * semi-gras, année 10 (« — indisponible » sans catalogue), et la raison 11,5
 * sur deux lignes sur la page Pour vous. Carte atténuée (0,7) quand il n'y a
 * nulle part où aller. Au doigt, pas de survol : l'appui long ouvre la feuille
 * — celle des cartes Vigie pour un titre hors bibliothèque (« Demander », la
 * note, Ma liste à l'arrivée), dont la pastille suit l'état (« Demandé »).
 */
export const RecoCard = memo(function RecoCard({ item, canOpen, onPress, onLongPress, reason }: {
  item: RecoRowItem;
  canOpen: boolean;
  onPress: () => void;
  onLongPress: () => void;
  reason?: string;
}) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const width = useCardWidth();
  const [broken, setBroken] = useState(false);
  const poster = recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { width: 300, quality: 80 }));
  const onDemand = item.jellyfinItemId === null;
  const face = useRecoMarkerItem(item);
  // Hors bibliothèque, Ma liste est une mise de côté jusqu'à l'arrivée : la carte la dit elle-même.
  const pending = useIsWatchlistPending(onDemand ? titleKey(item.mediaType, item.tmdbId) : null);
  const subtitle =
    onDemand && !canOpen
      ? [item.year, t("unavailableHint")].filter(Boolean).join(" — ")
      : item.year != null
        ? String(item.year)
        : null;

  return (
    <Pressable
      onPress={canOpen ? onPress : undefined}
      onLongPress={onLongPress}
      style={{ width, opacity: canOpen ? 1 : 0.7 }}
      aria-label={`${item.title}${item.year ? `, ${item.year}` : ""}`}
    >
      <div className="relative aspect-[2/3] rounded-xl bg-surface-2" style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.22)" }}>
        <div className="absolute inset-0 overflow-hidden rounded-xl bg-surface-2">
          {poster && !broken ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-4xl font-extrabold tracking-[-0.5px] text-content-disabled">
              {item.title.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {(onDemand || item.exploration) && (
          <div className="pointer-events-none absolute left-[7px] top-[7px] flex flex-col items-start gap-1">
            {onDemand && (
              <span className="rounded border-[0.5px] border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.65)] px-2 py-[3.5px] text-[10px] font-bold uppercase leading-3 tracking-[0.3px] text-on-media-primary">
                <RecoOnDemandLabel item={item} />
              </span>
            )}
            {item.exploration && (
              <span
                className="rounded px-2 py-[3.5px] text-[10px] font-bold uppercase leading-3 tracking-[0.3px] text-cta-brand-fg"
                style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
              >
                {t("explorationBadge")}
              </span>
            )}
          </div>
        )}
        <CardMarkerLayer
          item={face}
          communityRating={item.voteAverage}
          ratingClassName="bottom-1.5 left-1.5"
          statusClassName="right-[7px] top-[7px]"
          inWatchlist={onDemand ? pending : undefined}
        />
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold tracking-[-0.1px] text-content-primary">{item.title}</p>
      {subtitle && <p className="mt-0.5 truncate text-[10px] font-medium text-content-tertiary">{subtitle}</p>}
      {reason && <p className="mt-[3px] line-clamp-2 text-[11.5px] font-medium leading-[15px] text-content-tertiary">{reason}</p>}
    </Pressable>
  );
});
