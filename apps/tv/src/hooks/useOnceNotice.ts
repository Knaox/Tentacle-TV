import { useEffect, useRef, useState } from "react";

const NOTICE_MS = 5000;

/**
 * Un message du lecteur dit UNE fois, 5 s : il ne part que quand l'image est
 * là (`ready`) — armé sous l'écran de chargement, il s'y éteignait avant que
 * le film ne paraisse —, et un rechargement de piste (audio, sous-titres) ne
 * le rejoue pas. Il se réarme quand sa cause disparaît (`active` à faux).
 *
 * Partagé par « Qualité réduite » (`useAutoCapNotice`) et le message de
 * l'appareil (`useDeviceNotice`).
 */
export function useOnceNotice(active: boolean, ready: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!active) { shownRef.current = false; setVisible(false); }
  }, [active]);

  useEffect(() => {
    if (!active || !ready || shownRef.current) return;
    shownRef.current = true;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), NOTICE_MS);
    return () => { clearTimeout(timer); setVisible(false); };
  }, [active, ready]);

  return visible;
}
