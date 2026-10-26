/**
 * Octave en Liquid Glass — le FOND : le fond ambiant du socle (`GlassAmbient`,
 * cinq taches violet → rose sur l'encre, peintes une fois), teinté par la
 * POCHETTE EN COURS : ses deux teintes prennent la place de deux taches, bornées
 * pour que le verre reste lisible. Sans titre, ou une pochette sans couleur :
 * nos couleurs. Une vignette de 64 px suffit à la lecture des teintes.
 *
 * Monté une fois, dans la scène (`position: absolute`) : il ne se repeint qu'au
 * changement de pochette.
 */

import { memo } from "react";
import { GlassAmbient } from "../../../theme/glass";
import { useArtworkResolver } from "../components/Artwork";
import { sizedArtworkUrl } from "../components/artworkTone";
import { usePlayerSelector } from "../player/OctavePlayerProvider";

/** La taille de vignette lue pour les teintes (la plus petite de la route du cœur). */
const TINT_ARTWORK_SIZE = 64;

export const OctaveAmbient = memo(function OctaveAmbient() {
  const artworkUrl = usePlayerSelector((s) => s.current?.artworkUrl ?? null);
  const resolve = useArtworkResolver();
  const image = artworkUrl === null ? null : resolve(sizedArtworkUrl(artworkUrl, TINT_ARTWORK_SIZE));
  return <GlassAmbient image={image} position="absolute" />;
});
