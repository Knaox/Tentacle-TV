import { StarRating } from "../../components/rating/StarRating";
import { Place, type Animated, type Placed } from "./Place";

interface FauxStarsProps extends Placed, Animated {
  /** Note 1..10 (deux crans par étoile, comme dans l'app) ; 0 = pas encore notée. */
  value: number;
  size?: "xs" | "sm" | "md";
  tone?: "themed" | "onMedia";
}

const noop = () => {};

/** LES étoiles de l'app (`StarRating`), inertes : c'est la scène qui note. */
export function FauxStars({ value, size = "sm", tone = "onMedia", ...place }: FauxStarsProps) {
  return (
    <Place {...place}>
      <StarRating value={value > 0 ? value : null} onRate={noop} onClear={noop} size={size} tone={tone} />
    </Place>
  );
}
