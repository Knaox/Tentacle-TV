import { useEffect, useRef } from "react";
import type { ScrubGestureHandlers } from "./scrubGestureTypes";

export type { ScrubGestureHandlers, ScrubDir } from "./scrubGestureTypes";

// react-native-tvos expose useTVEventHandler / TVEventControl ; on passe par
// require (comme useTVRemote) pour éviter les frictions de typage du module.
const { useTVEventHandler, TVEventControl } = require("react-native") as {
  useTVEventHandler: (cb: (e: HWEvent) => void) => void;
  TVEventControl: { enableTVPanGesture: () => void; disableTVPanGesture: () => void };
};

interface HWEvent {
  eventType: string;
  body?: { state: "Began" | "Changed" | "Ended"; x: number; y: number; velocityX: number; velocityY: number };
}

/** Translation horizontale (pts) sous laquelle on ne scrub pas (centre mort). */
const DEAD_ZONE_PX = 20;
/** Cadence du loop d'avance continue (~30 fps). */
const LOOP_MS = 33;
/** Délai mini d'un geste avant d'engager le scrub : évite l'avance rapide
 *  accidentelle en SAISISSANT la télécommande (effleurement bref du trackpad).
 *  Le geste doit être actif depuis ce délai ET avoir franchi la dead-zone. */
const ENGAGE_DELAY_MS = 250;
/**
 * Courbe shuttle : translation |x| (pts depuis le début du geste) → vitesse de
 * scrub (secondes vidéo par seconde réelle) + label de palier façon DVD. Lookup
 * par palier (plus loin = plus vite), parité avec les labels 2x/4x/8x affichés.
 */
const SPEED_CURVE: { px: number; rate: number; label: string | null }[] = [
  { px: DEAD_ZONE_PX, rate: 0, label: null },
  { px: 50, rate: 10, label: null },
  { px: 100, rate: 30, label: "2x" },
  { px: 160, rate: 80, label: "4x" },
  { px: 220, rate: 200, label: "8x" },
];

function rateFor(translationX: number): { rate: number; label: string | null } {
  const mag = Math.abs(translationX);
  if (mag < DEAD_ZONE_PX) return { rate: 0, label: null };
  const dir = translationX > 0 ? 1 : -1;
  let chosen = SPEED_CURVE[0];
  for (const t of SPEED_CURVE) if (mag >= t.px) chosen = t;
  const label = chosen.label ? `${dir > 0 ? "▶▶" : "◀◀"} ${chosen.label}` : null;
  return { rate: chosen.rate * dir, label };
}

/**
 * Scrub gestuel — variante **Apple TV (tvOS)**, modèle **SHUTTLE**.
 *
 * La Siri Remote n'émet ni `longLeft`/`longRight` ni `rewind`/`fastForward`. On
 * active le pan gesture et on traduit la TRANSLATION du doigt (depuis le début
 * du geste, donc relative → repart de 0 à chaque pose) en une VITESSE de scrub
 * continue : plus le doigt est loin du centre, plus c'est rapide (paliers
 * 2x/4x/8x). Un loop avance la position fantôme par vitesse×dt.
 *
 * Avantage vs l'ancien modèle « déplacement → pas » : la surface finie du
 * trackpad ne pose plus problème. Lever puis reposer le doigt repart proprement
 * (translation = 0) SANS reculer — le scrub reste ouvert côté cerveau (OK valide,
 * BACK annule), startScrubbing étant idempotent.
 */
export function useScrubGestures({
  enabled, onStartScrub, onNudgeScrub, onSpeedLabel, onEndScrub, onWake,
}: ScrubGestureHandlers): void {
  // Callbacks à jour sans recréer le handler natif.
  const cbRef = useRef({ onStartScrub, onNudgeScrub, onSpeedLabel, onEndScrub, onWake });
  cbRef.current = { onStartScrub, onNudgeScrub, onSpeedLabel, onEndScrub, onWake };

  const startXRef = useRef(0);        // origine du geste (x au Began)
  const beganAtRef = useRef(0);       // timestamp du Began (délai d'engagement)
  const gestureScrubRef = useRef(false); // ce geste a-t-il franchi la dead-zone
  const rateRef = useRef(0);          // vitesse courante (s vidéo / s réelle)
  const lastLabelRef = useRef<string | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(0);

  const stopLoop = () => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    rateRef.current = 0;
  };
  const startLoop = () => {
    if (loopRef.current) return;
    lastTickRef.current = Date.now();
    loopRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (rateRef.current !== 0) cbRef.current.onNudgeScrub(rateRef.current * dt);
    }, LOOP_MS);
  };

  useEffect(() => {
    if (!enabled) return;
    TVEventControl.enableTVPanGesture();
    return () => { TVEventControl.disableTVPanGesture(); stopLoop(); };
  }, [enabled]);

  useTVEventHandler((evt: HWEvent) => {
    if (!enabled || evt.eventType !== "pan" || !evt.body) return;
    const { state, x } = evt.body;

    if (state === "Began") {
      startXRef.current = x;          // repère relatif → reprise propre au reposer
      beganAtRef.current = Date.now();
      gestureScrubRef.current = false;
      return;
    }

    if (state === "Changed") {
      const tx = x - startXRef.current;
      if (!gestureScrubRef.current) {
        if (Math.abs(tx) < DEAD_ZONE_PX) return; // pas encore franchi la dead-zone
        if (Date.now() - beganAtRef.current < ENGAGE_DELAY_MS) return; // délai anti-saisie accidentelle
        gestureScrubRef.current = true;
        cbRef.current.onStartScrub();  // idempotent côté cerveau (garde)
        startLoop();
      }
      const { rate, label } = rateFor(tx);
      rateRef.current = rate;
      if (label !== lastLabelRef.current) { lastLabelRef.current = label; cbRef.current.onSpeedLabel(label); }
      return;
    }

    // Ended : stop la vitesse, le scrub reste ouvert (OK valide / BACK annule).
    stopLoop();
    if (lastLabelRef.current !== null) { lastLabelRef.current = null; cbRef.current.onSpeedLabel(null); }
    if (gestureScrubRef.current) {
      gestureScrubRef.current = false;
      cbRef.current.onEndScrub();
    } else {
      cbRef.current.onWake();          // simple effleurement → réveiller l'OSD
    }
  });
}
