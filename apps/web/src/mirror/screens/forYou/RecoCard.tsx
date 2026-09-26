import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, useJellyfinClient, type RecoRowItem } from "@tentacle-tv/api-client";
import { CardRatingBadge } from "../../../components/cards/CardRatingBadge";
import { Pressable } from "../../ui/Pressable";
import { useCardWidth } from "../../useMirrorLayout";

/**
 * `RecoCard` de l'app : l'affiche 2:3 (rayon 12, ombre elev2) d'une
 * recommandation — badge « À la demande » en haut à gauche hors bibliothèque,
 * « Découverte » au dégradé en haut à droite, la note en bas à DROITE ; titre
 * 13 semi-gras, année 10 (« — indisponible » sans catalogue), et la raison
 * 11,5 sur deux lignes sur la page Pour vous. Carte atténuée (0,7) quand il
 * n'y a nulle part où aller.
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
        {onDemand && (
          <span className="absolute left-[7px] top-[7px] rounded border-[0.5px] border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.65)] px-2 py-[3.5px] text-[10px] font-bold uppercase leading-3 tracking-[0.3px] text-on-media-primary">
            {t("onDemandBadge")}
          </span>
        )}
        {item.exploration && (
          <span
            className="absolute right-[7px] top-[7px] rounded px-2 py-[3.5px] text-[10px] font-bold uppercase leading-3 tracking-[0.3px] text-cta-brand-fg"
            style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
          >
            {t("explorationBadge")}
          </span>
        )}
        <CardRatingBadge rating={item.voteAverage} className="bottom-[7px] right-[7px]" />
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold tracking-[-0.1px] text-content-primary">{item.title}</p>
      {subtitle && <p className="mt-0.5 truncate text-[10px] font-medium text-content-tertiary">{subtitle}</p>}
      {reason && <p className="mt-[3px] line-clamp-2 text-[11.5px] font-medium leading-[15px] text-content-tertiary">{reason}</p>}
    </Pressable>
  );
});
