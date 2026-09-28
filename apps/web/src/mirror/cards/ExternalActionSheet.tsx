import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck, EyeOff, Film, Loader2, Plus, Tv } from "lucide-react";
import { useDeleteRating, useItemRating, useRateItem } from "@tentacle-tv/api-client";
import { externalCardActionEntries, resolveExternalCardOverlay, type ExternalCardVariant } from "@tentacle-tv/shared";
import { ActionSheet } from "../ui/ActionSheet";
import { ActionCell } from "./MediaActionSheet";
import { StarRating } from "../../components/rating/StarRating";
import { useExternalTitleActions } from "../../components/cards/external/useExternalTitleActions";
import type { ExternalTitle } from "../../components/cards/external/useTitleProvider";

/** Ce que la feuille montre d'un titre hors bibliothèque. */
export interface ExternalSheetTarget {
  title: ExternalTitle;
  name: string;
  year: number | null;
  imageUrl: string | null;
}

/**
 * La feuille de l'appui long d'une carte HORS bibliothèque — le pendant tactile
 * du survol des cartes Vigie (`externalCardOverlay.ts`), dans l'ordre que le
 * modèle fixe : l'action primaire (« Demander »), la note, puis la bascule
 * « Ma liste à l'arrivée » et, sur une recommandation, « Ne plus me proposer ».
 * Même bandeau que `MediaActionSheet`.
 */
export function ExternalActionSheet({ target, variant, onClose, extra, onDismiss }: {
  target: ExternalSheetTarget | null;
  variant: ExternalCardVariant;
  onClose: () => void;
  /** Sous le bandeau : les raisons d'une recommandation. */
  extra?: ReactNode;
  onDismiss?: () => void;
}) {
  // La feuille descend encore un instant après sa fermeture : elle garde son titre.
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);
  const body = target ?? shown;

  return (
    <ActionSheet open={target !== null} onClose={onClose} label={body?.name}>
      {body && <SheetBody target={body} variant={variant} onClose={onClose} extra={extra} onDismiss={onDismiss} />}
    </ActionSheet>
  );
}

/** Le contenu, monté seulement feuille ouverte : Ma liste, la note et la demande n'existent qu'alors. */
function SheetBody({ target, variant, onClose, extra, onDismiss }: {
  target: ExternalSheetTarget;
  variant: ExternalCardVariant;
  onClose: () => void;
  extra?: ReactNode;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation("cards");
  const { t: tc } = useTranslation("common");
  const actions = useExternalTitleActions(target.title);
  const overlay = resolveExternalCardOverlay({ variant, request: actions.state?.request ?? null, identified: true });
  const entries = externalCardActionEntries(overlay, { watchlist: actions.pending });
  const rating = useItemRating(actions.ratingIdentity);
  const rate = useRateItem();
  const remove = useDeleteRating();
  const Icon = target.title.mediaType === "tv" ? Tv : Film;
  const request = entries.find((e) => e.kind === "request");

  return (
    <>
      <div className="mx-4 mb-4 mt-2 flex items-center gap-3">
        <div className="relative flex h-[76px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2" style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.22)" }}>
          {target.imageUrl ? <img src={target.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={22} className="text-content-quaternary" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-[3px] line-clamp-2 text-base font-bold tracking-[-0.2px] text-content-primary">{target.name}</p>
          <p className="truncate text-[13px] font-medium tracking-[0.2px] text-brand-light">
            {[target.year, target.title.mediaType === "tv" ? tc("series") : tc("movie")].filter(Boolean).join(" · ")}
          </p>
          {actions.state?.badge && (
            <p className="mt-1 truncate text-xs font-semibold text-content-secondary">{actions.state.badge.label}</p>
          )}
        </div>
      </div>
      {extra && <div className="mx-4 mb-4">{extra}</div>}
      {request && (
        <div className="px-4 pb-3">
          <button
            type="button"
            disabled={actions.requesting}
            onClick={() => { actions.request(); if (actions.state?.request?.mode === "open") onClose(); }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-[15px] font-bold text-cta-brand-fg active:opacity-85 disabled:opacity-70"
          >
            {actions.requesting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Plus size={18} strokeWidth={2.5} aria-hidden />}
            {request.label}
          </button>
        </div>
      )}
      {overlay.rate && (
        <div className="mx-4 mb-3 flex flex-col items-center gap-1.5 rounded-xl bg-fill-faint px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-content-tertiary">{t("rateTitle")}</p>
          <StarRating
            size="md"
            value={rating?.score ?? null}
            onRate={(score) => rate.mutate({ ...actions.ratingIdentity, score })}
            onClear={() => remove.mutate(actions.ratingIdentity)}
          />
        </div>
      )}
      <div className="flex gap-2.5 px-4 pb-3">
        {entries.map((entry) => {
          if (entry.kind === "watchlist") {
            return (
              <ActionCell
                key="watchlist"
                Icon={entry.active ? BookmarkCheck : Bookmark}
                label={t(entry.active ? "watchlistOnArrival" : "addToWatchlistOnArrival")}
                active={entry.active === true}
                color="var(--brand)"
                onPress={actions.toggleWatchlist}
              />
            );
          }
          if (entry.kind === "dismiss" && onDismiss) {
            return (
              <ActionCell
                key="dismiss"
                Icon={EyeOff}
                label={t("dismiss")}
                active={false}
                color="var(--text-primary)"
                onPress={() => { onDismiss(); onClose(); }}
              />
            );
          }
          return null;
        })}
      </div>
    </>
  );
}
