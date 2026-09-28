import { motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailPlayButton } from "./DetailPlayButton";
import { DetailActionCapsule } from "./DetailActionCapsule";
import { TrailerButton } from "./TrailerButton";
import { DetailRating } from "../rating/DetailRating";
import { fadeUp } from "../../theme/motion";

/**
 * La rangée d'actions de la scène, par ordre d'importance : Lecture (seule en
 * couleur), bande-annonce, la capsule des bascules, puis votre note. Même
 * hauteur de 56 px pour les quatre : une ligne, pas un empilement de tailles.
 */
export function DetailActions({ item, collectionCount }: { item: MediaItem; collectionCount?: number }) {
  return (
    <motion.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
      <DetailPlayButton item={item} collectionCount={collectionCount} />
      <TrailerButton item={item} />
      <DetailActionCapsule item={item} />
      {/* Note explicite — s'efface d'elle-même sans tmdbId (titre non notable). */}
      <DetailRating item={item} tone="media" />
    </motion.div>
  );
}
