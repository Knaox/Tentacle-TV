/**
 * Octave mobile — « Sélectionner » / « Terminé » d'une page de titres (album), posé dans l'emplacement droit de la
 * barre du haut (`PageTopBar right`), à côté du cœur. Verre de Tentacle, comme la barre des listes (`BarButtons`).
 * Rien sans au moins deux titres.
 */

import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { GlassTextButton } from "../../playlists/screens/BarButtons";

interface Props {
  tracks: readonly MusicTrack[];
  selecting: boolean;
  onStart: () => void;
  onDone: () => void;
}

export function SelectionToggle({ tracks, selecting, onStart, onDone }: Props) {
  const { t } = useTranslation("music");
  if (tracks.length < 2) return null;
  return <GlassTextButton label={t(selecting ? "selection.done" : "selection.start")} strong={selecting} onPress={selecting ? onDone : onStart} />;
}
