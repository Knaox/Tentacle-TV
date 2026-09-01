import { useCallback, useEffect, useRef, useState } from "react";

interface BillboardRotationOptions {
  /** Nombre de diapositives — 0 ou 1 : jamais de minuterie. */
  count: number;
  /** Intervalle de rotation en ms (0 = désactivée). */
  rotateMs: number;
  /** Faux = minuterie suspendue (économie de données, hors écran, inactivité —
   *  les raisons vivent chez l'appelant). L'index est conservé : la reprise
   *  est invisible. */
  active: boolean;
}

/**
 * La minuterie du carrousel héros, partagée entre l'accueil et les
 * recommandations : rotation automatique, navigation manuelle avec pause
 * éphémère (le clic ne se bat pas contre le timer), cascade de texte rejouée
 * via `animKey`. Extraite de HeroBillboard à l'identique — seule addition :
 * le clamp de l'index quand `count` rétrécit (« Ne plus me proposer » retire
 * une diapositive), SANS toucher `animKey` pour ne pas rejouer la cascade.
 */
export function useBillboardRotation({ count, rotateMs, active }: BillboardRotationOptions) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pausedRef = useRef(false);

  const advance = useCallback(
    (delta: 1 | -1) => {
      if (!count) return;
      setIndex((i) => (i + delta + count) % count);
      setAnimKey((k) => k + 1);
    },
    [count]
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= count) return;
      setIndex(i);
      setAnimKey((k) => k + 1);
    },
    [count]
  );

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (!active) return;
    if (rotateMs > 0 && count > 1 && !pausedRef.current) {
      timerRef.current = setInterval(() => advance(1), rotateMs);
    }
  }, [rotateMs, count, advance, active]);

  // Relancée à chaque changement d'index : une diapositive entière après une
  // navigation manuelle, jamais un reliquat de minuterie.
  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer, index]);

  // `count` a rétréci (retrait optimiste d'une diapositive) : on se recale.
  useEffect(() => {
    if (count > 0) setIndex((i) => (i >= count ? count - 1 : i));
  }, [count]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    clearInterval(timerRef.current);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    startTimer();
  }, [startTimer]);

  // Navigation manuelle : pause éphémère de 100 ms, le temps d'absorber le clic.
  const selectWithGrace = useCallback(
    (i: number) => {
      goTo(i);
      pause();
      setTimeout(resume, 100);
    },
    [goTo, pause, resume]
  );
  const prevWithGrace = useCallback(() => {
    advance(-1);
    pause();
    setTimeout(resume, 100);
  }, [advance, pause, resume]);
  const nextWithGrace = useCallback(() => {
    advance(1);
    pause();
    setTimeout(resume, 100);
  }, [advance, pause, resume]);

  return { index, animKey, advance, goTo, selectWithGrace, prevWithGrace, nextWithGrace };
}
