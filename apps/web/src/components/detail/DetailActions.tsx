import { useState } from "react";
import { motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailPlayButton } from "./DetailPlayButton";
import { DetailActionCapsule } from "./DetailActionCapsule";
import { TrailerButton } from "./TrailerButton";
import { DetailRating } from "../rating/DetailRating";
import { DetailVersionPicker } from "./DetailVersionPicker";
import { fadeUp } from "../../theme/motion";

/**
 * La rangée d'actions de la scène, par ordre d'importance : Lecture (seule en
 * couleur), bande-annonce, la capsule des bascules, puis votre note. Même
 * hauteur de 56 px pour les quatre : une ligne, pas un empilement de tailles.
 * Dessous, le choix de la version quand le titre en a plusieurs.
 */
export function DetailActions({ item, collectionCount }: { item: MediaItem; collectionCount?: number }) {
  const [version, setVersion] = useState<string | null>(null);
  return (
    <motion.div variants={fadeUp} className="mt-7">
      <div className="flex flex-wrap items-center gap-3">
        <DetailPlayButton item={item} collectionCount={collectionCount} version={version} />
        <TrailerButton item={item} />
        <DetailActionCapsule item={item} />
        {/* Note explicite — s'efface d'elle-même sans tmdbId (titre non notable). */}
        <DetailRating item={item} tone="media" />
      </div>
      <DetailVersionPicker item={item} value={version} onChange={setVersion} />
    </motion.div>
  );
}
