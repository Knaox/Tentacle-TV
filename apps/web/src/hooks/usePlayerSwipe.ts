import { useCallback, useRef, type MutableRefObject, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_MAX_DURATION_MS = 600;

/**
 * Balayage horizontal sur la surface vidéo : +30 s vers la droite, −10 s vers
 * la gauche ; le tap simple reste la bascule lecture/pause. Le scrubber a son
 * propre `onTouchStart` qui arrête la propagation, donc pas de collision.
 *
 * Extraction mécanique de VideoPlayer (limite 300 lignes/fichier),
 * comportement inchangé.
 */
export function usePlayerSwipe(
  skipBy: (seconds: number) => void,
  userInteractedRef: MutableRefObject<boolean>,
) {
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    userInteractedRef.current = true;
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, [userInteractedRef]);

  const onTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Reconnaît un balayage horizontal franc — pas un glissé lent ni un tap.
    if (Date.now() - start.t > SWIPE_MAX_DURATION_MS) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) <= Math.abs(dy)) return; // composante verticale dominante = défilement
    e.preventDefault();
    e.stopPropagation();
    skipBy(dx > 0 ? 30 : -10);
  }, [skipBy, userInteractedRef]);

  return { onTouchStart, onTouchEnd };
}
