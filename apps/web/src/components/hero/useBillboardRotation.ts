import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Temps restant du cycle de la diapositive courante — zéro si le cycle est
 * écoulé : le zoom est allé au bout, l'image est immobile.
 */
export function remainingInCycle(rotateMs: number, cycleStartedAt: number, now: number): number {
  return Math.max(0, rotateMs - (now - cycleStartedAt));
}

interface BillboardRotationOptions {
  /** Nombre de diapositives — 0 ou 1 : jamais de minuterie. */
  count: number;
  /** Intervalle de rotation en ms (0 = désactivée). */
  rotateMs: number;
  /** Faux = minuterie suspendue (économie de données, hors écran, inactivité —
   *  les raisons vivent chez l'appelant). L'index est conservé. À la reprise,
   *  le cycle repart LÀ OÙ IL EN ÉTAIT ; s'il est écoulé, la diapositive
   *  suivante arrive aussitôt. */
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pausedRef = useRef(false);
  // Début du cycle de la diapositive courante. Déclaré AVANT l'effet de la
  // minuterie : à index égal, React joue les effets dans l'ordre, et la
  // minuterie doit lire un début déjà à jour.
  const cycleStartRef = useRef(performance.now());
  useEffect(() => {
    cycleStartRef.current = performance.now();
  }, [index]);

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
    clearTimeout(timerRef.current);
    if (!active || rotateMs <= 0 || count <= 1 || pausedRef.current) return;
    // Un seul tir, jamais un intervalle : chaque avancée change l'index, et
    // l'effet ci-dessous réarme un cycle entier. Une REPRISE (inactivité,
    // retour à l'écran, fin du mode économie) n'attend donc que le reste du
    // cycle en cours ; cycle écoulé — le zoom est allé au bout, l'image est
    // immobile —, la diapositive suivante arrive aussitôt. C'est ce qui fait
    // lire « ça repart » au premier geste, au lieu d'une image figée pendant
    // encore huit secondes.
    const delay = remainingInCycle(rotateMs, cycleStartRef.current, performance.now());
    timerRef.current = setTimeout(() => advance(1), delay);
  }, [rotateMs, count, advance, active]);

  // Relancée à chaque changement d'index : une diapositive entière après une
  // navigation manuelle, jamais un reliquat de minuterie.
  useEffect(() => {
    startTimer();
    return () => clearTimeout(timerRef.current);
  }, [startTimer, index]);

  // `count` a rétréci (retrait optimiste d'une diapositive) : on se recale.
  useEffect(() => {
    if (count > 0) setIndex((i) => (i >= count ? count - 1 : i));
  }, [count]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    clearTimeout(timerRef.current);
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
