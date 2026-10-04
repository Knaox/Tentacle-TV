import { useCallback, type MutableRefObject } from "react";
import { useTranscodeSeek, type TranscodeSeek } from "@tentacle-tv/api-client";
import type { MpvState } from "./mpvRuntime";
import { SEEK_END_EPS_S } from "./useSmartSeek";

/**
 * Les sauts du lecteur de bureau : ±10/30 s et « jusqu'au bout ».
 * Extrait de `DesktopPlayer` (limite de 300 lignes par fichier).
 *
 * Sur un flux CONVERTI par le serveur, les sauts passent par la règle
 * partagée (`useTranscodeSeek`) : des appuis rapides — flèches, boutons,
 * poignée de la barre qu'on glisse — font UN seul déplacement de mpv, donc un
 * seul ffmpeg relancé par Jellyfin, et l'attente se dit (`seekWait`).
 */
export function useDesktopSkip({
  state, dur, effectiveMpvOffset, seek, seekRelative, groupActive, onUserSeek, transcoding,
}: {
  state: MpvState;
  /** Durée affichée (film) — celle de Jellyfin si elle est connue. */
  dur: number;
  effectiveMpvOffset: MutableRefObject<number>;
  seek: (pos: number) => Promise<void>;
  seekRelative: (delta: number) => Promise<void>;
  /** Séance Watch Together : les ±10/30 s deviennent des seeks ABSOLUS —
   *  un seek relatif mpv atterrit sur une image clé (`hr-seek=default`), la
   *  cible rapportée à la salle serait fausse d'un GOP — et sont rapportés. */
  groupActive?: boolean;
  onUserSeek?: (targetFilmSeconds: number) => void;
  /** Le flux est un transcodage HLS de Jellyfin. */
  transcoding: boolean;
}): {
  seekToMpvEnd: () => void;
  skipRelativeOrEnd: (delta: number) => void;
  /** Le seek de la barre (position mpv) : regroupé pendant un transcodage. */
  seekbarSeek: (pos: number) => Promise<void>;
  seekWait: TranscodeSeek;
} {
  // La FIN, en espace mpv : la durée de SON flux — l'offset de transcode ne
  // s'y applique pas. Avec `keep-open`, ce saut lève l'EOF réel de mpv
  // (`eof-reached`), et l'affiche de fin paraît : le geste manuel vaut l'EOF
  // naturel. Les cibles se comparent, elles, en POSITION FILM.
  const seekToMpvEnd = useCallback(() => {
    if (state.duration > 0) void seek(state.duration);
  }, [state.duration, seek]);

  // Une série d'appuis regroupée, appliquée UNE fois : vers la fin, elle la
  // termine ; ailleurs, un seek absolu (précis : `useMpvExactSeek`).
  const seekWait = useTranscodeSeek({
    transcoding, duration: dur,
    position: () => state.position + effectiveMpvOffset.current,
    apply: (target) => {
      if (dur > 0 && target >= dur - SEEK_END_EPS_S) { seekToMpvEnd(); return; }
      void seek(Math.max(0, target - effectiveMpvOffset.current));
      if (groupActive) onUserSeek?.(target);
    },
  });
  const { seekBy, seekTo } = seekWait;

  // Un +30 s dont la cible atteint la fin — ou la dépasse — TERMINE la
  // lecture au lieu de se caler sur le bord. Un recul ne termine jamais.
  const skipRelativeOrEnd = useCallback((delta: number) => {
    if (transcoding) { seekBy(delta); return; }
    const filmPos = state.position + effectiveMpvOffset.current;
    if (delta > 0 && dur > 0 && filmPos + delta >= dur - SEEK_END_EPS_S) {
      seekToMpvEnd();
      return;
    }
    if (groupActive) {
      const target = Math.max(0, filmPos + delta);
      void seek(Math.max(0, target - effectiveMpvOffset.current));
      onUserSeek?.(target);
      return;
    }
    void seekRelative(delta);
  }, [dur, state.position, effectiveMpvOffset, seek, seekRelative, seekToMpvEnd, groupActive, onUserSeek, transcoding, seekBy]);

  // La poignée glissée seeke à chaque mouvement pour l'aperçu : sur un flux
  // converti, chacun relançait un ffmpeg. Regroupés, seul le dernier part.
  const seekbarSeek = useCallback(async (pos: number) => {
    if (!transcoding) return seek(pos);
    seekTo(pos + effectiveMpvOffset.current, { settle: true });
  }, [transcoding, seek, seekTo, effectiveMpvOffset]);

  return { seekToMpvEnd, skipRelativeOrEnd, seekbarSeek, seekWait };
}
