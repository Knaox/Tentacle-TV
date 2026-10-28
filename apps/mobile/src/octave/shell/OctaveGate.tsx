/**
 * Octave (mobile) — la PORTE du mode : rien d'Octave sans un serveur qui
 * déclare `music.library` et un compte qui a la musique et le droit « Accès à
 * Octave » (`useOctaveAvailability`, api-client). Règle partagée
 * `octaveStayVerdict` : une panne n'est jamais une absence (le hors ligne
 * reste dans Octave) ; une absence ÉTABLIE éteint le mode et rend l'accueil de
 * Tentacle, sans erreur. Chaque réponse établie est retenue (miroir) pour le
 * prochain lancement.
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useMusicStatus, useOctaveAvailability } from "@tentacle-tv/api-client";
import { octaveStayVerdict } from "@tentacle-tv/shared/octave/mode";
import { mirrorAvailableNow, noteOctaveAvailability } from "../mode/octaveMirror";
import { useLeaveOctave } from "../mode/useOctaveSwitch";
import { useOctaveColors } from "../theme/octaveColors";

export function OctaveGate({ children }: { children: ReactNode }) {
  const fresh = useOctaveAvailability();
  const failed = useMusicStatus().isError;
  const colors = useOctaveColors();
  const leave = useLeaveOctave();
  const mirrorAvailable = useMemo(mirrorAvailableNow, []);
  const verdict = octaveStayVerdict({ fresh, failed, mirrorAvailable });

  useEffect(() => {
    if (fresh.settled && !failed) noteOctaveAvailability(fresh.available);
  }, [fresh.settled, fresh.available, failed]);
  // Une seule sortie par montage : jamais un aller-retour Tentacle ↔ Octave en boucle.
  const left = useRef(false);
  useEffect(() => {
    if (verdict !== "leave" || left.current) return;
    left.current = true;
    leave();
  }, [verdict, leave]);

  if (verdict !== "open") return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  return <>{children}</>;
}
