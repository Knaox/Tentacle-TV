import { useTranslation } from "react-i18next";
import { useDeleteRating, useItemRating, useRateItem, type RatingIdentity } from "@tentacle-tv/api-client";
import { TouchStarRating } from "../../ui/TouchStarRating";

interface SheetRatingProps {
  /** Ce que notent les étoiles — `null` le temps que la série se charge. */
  identity: RatingIdentity | null;
  /** L'item Jellyfin rattaché : la carte retrouve la note sans tmdb. */
  jellyfinItemId: string | null;
}

/**
 * La note, au pied de la feuille — `RatingPanelMobile` de l'app, variante
 * « feuille » : un surtitre (« Noter ce titre », ou « Votre note » et sa
 * pastille), cinq étoiles au doigt, une phrase d'aide.
 *
 * Le MOTEUR DE NOTES de Tentacle (`/api/ratings`), pas Jellyfin — la même
 * source que le survol du bureau. Écriture optimiste : la pastille de la
 * carte, sous la feuille, prend la note aussitôt.
 */
export function SheetRating({ identity, jellyfinItemId }: SheetRatingProps) {
  const { t } = useTranslation("cards");
  const { t: tReco } = useTranslation("reco");
  const rating = useItemRating(identity, { enabled: identity !== null });
  const rate = useRateItem();
  const remove = useDeleteRating();
  const value = rating?.score ?? null;

  return (
    <section className="mx-4 flex flex-col items-center gap-2 pb-1 pt-2">
      <div className="flex min-h-5 items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[1.2px] text-content-secondary">
          {value !== null ? tReco("yourRating") : t("rateTitle")}
        </h3>
        {value !== null && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold leading-[14px] tabular-nums text-cta-brand-fg"
            style={{ background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
          >
            {tReco("ratingValue", { score: value })}
          </span>
        )}
      </div>
      <div className="py-[5px]">
        <TouchStarRating
          value={value}
          disabled={identity === null}
          onRate={(score) => identity && rate.mutate({ ...identity, jellyfinItemId: jellyfinItemId ?? undefined, score })}
          onClear={() => identity && remove.mutate(identity)}
        />
      </div>
      <p className="text-center text-xs text-content-tertiary">{value !== null ? t("ratedHint") : t("rateHint")}</p>
    </section>
  );
}
