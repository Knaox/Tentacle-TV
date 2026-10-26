/**
 * Octave en Liquid Glass — le FOND : l'encre prune et de grandes taches de
 * couleur douces, ce que les verres d'Octave réfractent (maquette « Octave ·
 * Playlist »). Les couleurs d'Octave — le rose de la musique, le violet de
 * Tentacle — et, quand un titre est là, la TEINTE DE SA POCHETTE
 * (`useArtworkTint`, celle de l'eau du lecteur « en cours ») à la place des
 * deux taches froides de la maquette.
 *
 * Coût (CLAUDE.md, « Coût GPU ») : UNE couche FIXE, des dégradés radiaux peints
 * une fois (aucun `filter: blur`, rien d'animé) ; elle ne se repeint qu'au
 * changement de pochette.
 */

import { memo, type CSSProperties } from "react";
import { useArtworkTint } from "../motion/useArtworkTint";
import { usePlayerSelector } from "../player/OctavePlayerProvider";

export const OctaveAmbient = memo(function OctaveAmbient() {
  const artworkUrl = usePlayerSelector((s) => s.current?.artworkUrl ?? null);
  const tint = useArtworkTint(artworkUrl);
  const style = tint === null ? undefined : ({ "--oc-ambient-tint": tint } as CSSProperties);
  return <div aria-hidden className="octave-ambient" data-tinted={tint === null ? undefined : "true"} style={style} />;
});
