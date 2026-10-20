import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { SkipProposal } from "../playback/playbackOverlay.types";
import {
  TICKS_PER_MS, TICKS_PER_SECOND, isGroupSessionActive, wtPlayerAligned, wtPositionTicksAt, wtSkipHeld,
  type SegmentType,
} from "@tentacle-tv/shared";
import { useWatchTogetherOrIdle } from "./context";

/**
 * Le décompte de saut de la SALLE, tel que ce lecteur l'affiche : armé par
 * le serveur en position de média, il se lit sur la position extrapolée de
 * la salle — le même chiffre chez tous, figé pendant une pause. Et la
 * proposition inverse : ce lecteur entre dans un passage à sauter, il le
 * dit au serveur (qui arme, ou ignore s'il est réglé). Et la garde : tant que
 * la salle n'est pas « tous prêts », `skipHeld` — à passer à la coquille de
 * lecture (`groupSkipHeld`), qui ne montre alors aucun saut. Ni tant que CE
 * lecteur n'est pas là où est la salle (`playerPositionSeconds`, position
 * film : un arrivant pas encore posé, un rechargement, un saut en vol).
 */
export function useGroupSkipCountdown(itemId: string | undefined, playerPositionSeconds?: number): {
  groupSkip: { segmentType: SegmentType; countdownSeconds: number } | null;
  onSkipPropose: (proposal: SkipProposal) => void;
  /** La salle n'est pas « tous prêts » : aucun saut (→ `groupSkipHeld`). */
  skipHeld: boolean;
} {
  const { room, serverNow, send, isInGroup } = useWatchTogetherOrIdle();
  const active = isGroupSessionActive(isInGroup, room, itemId) && room?.itemId === itemId;
  const pending = active ? room?.pendingSkip ?? null : null;

  // Un battement à 4 Hz tant qu'un décompte court : le chiffre suit la salle.
  const [beat, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!pending) return;
    const clock = setInterval(tick, 250);
    return () => clearInterval(clock);
  }, [pending]);

  const groupSkip = useMemo(() => {
    if (!pending || !room) return null;
    const remainingTicks = pending.skipAtPositionTicks - wtPositionTicksAt(room, serverNow());
    return {
      segmentType: pending.segmentType,
      countdownSeconds: Math.max(1, Math.ceil(remainingTicks / TICKS_PER_SECOND)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, room, serverNow, beat]);

  const onSkipPropose = useCallback((proposal: SkipProposal) => {
    if (!active) return;
    send({
      type: "wt:skipPropose",
      segmentType: proposal.segmentType,
      isEpisode: proposal.isEpisode,
      segmentStartTicks: Math.max(0, Math.round(proposal.segmentStartMs * TICKS_PER_MS)),
      toTicks: Math.max(0, Math.round(proposal.toMs * TICKS_PER_MS)),
    });
  }, [active, send]);

  // « Tous prêts » : le serveur le dit (`allReady`), sinon l'état en juge ; et le
  // lecteur doit être là où est la salle.
  const misaligned = !!room && playerPositionSeconds !== undefined
    && !wtPlayerAligned(room, serverNow(), playerPositionSeconds);
  const skipHeld = active && (wtSkipHeld(room, itemId) || misaligned);

  return { groupSkip, onSkipPropose, skipHeld };
}
