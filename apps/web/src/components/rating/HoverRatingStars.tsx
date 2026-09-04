import { useDeleteRating, useItemRating, useRateItem } from "@tentacle-tv/api-client";
import type { RatingIdentity } from "@tentacle-tv/api-client";
import { StarRating } from "./StarRating";

interface HoverRatingStarsProps {
  identity: RatingIdentity;
  jellyfinItemId?: string | null;
}

/**
 * Étoiles de saisie du voile de survol d'une carte. Composant DÉDIÉ, monté
 * uniquement pendant le survol (useMountWhile chez l'appelant) — c'est sa
 * raison d'être : useItemRating s'abonne à la requête globale ["ratings"] ;
 * logé au niveau tuile, chaque affiche porterait l'abonnement en permanence
 * et une note re-rendrait toute la grille. Ici, l'abonnement n'existe que le
 * temps du survol. stopPropagation : noter ne doit jamais naviguer.
 */
export function HoverRatingStars({ identity, jellyfinItemId }: HoverRatingStarsProps) {
  const rating = useItemRating(identity);
  const rate = useRateItem();
  const remove = useDeleteRating();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <StarRating
        size="sm"
        tone="onMedia"
        value={rating?.score ?? null}
        onRate={(score) =>
          rate.mutate({
            ...identity,
            jellyfinItemId: jellyfinItemId ?? undefined,
            score,
          })
        }
        onClear={() => remove.mutate(identity)}
      />
    </div>
  );
}
