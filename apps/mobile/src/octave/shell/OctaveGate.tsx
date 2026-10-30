/**
 * Octave (mobile) — la PORTE du mode : rien d'Octave sans un serveur qui
 * déclare `music.library` et un compte qui a la musique et le droit « Accès à
 * Octave » (`useOctaveAvailability`, api-client). Règle partagée
 * `octaveStay.ts` : une panne n'est jamais une absence — hors ligne, ou
 * `/api/config` fini sans réponse (démarrage à froid sans réseau : capacités
 * vides), Octave reste et montre la musique gardée ; seule une absence ÉTABLIE
 * par un serveur qui a répondu éteint le mode et rend l'accueil de Tentacle,
 * sans erreur. Seules ces réponses établies entrent dans le miroir du prochain
 * lancement (`octaveMirrorNote`).
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useMusicStatus, useOctaveAvailability, useServerCapabilities } from "@tentacle-tv/api-client";
import { octaveMirrorNote, octaveStayVerdict } from "@tentacle-tv/shared/octave/mode";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { mirrorAvailableNow, noteOctaveAvailability } from "../mode/octaveMirror";
import { useLeaveOctave } from "../mode/useOctaveSwitch";
import { useOctaveColors } from "../theme/octaveColors";

export function OctaveGate({ children }: { children: ReactNode }) {
  const fresh = useOctaveAvailability();
  const failed = useMusicStatus().isError;
  const configKnown = useServerCapabilities().known;
  const offline = useOfflineMode();
  const colors = useOctaveColors();
  const leave = useLeaveOctave();
  const mirrorAvailable = useMemo(mirrorAvailableNow, []);
  const verdict = octaveStayVerdict({ fresh, failed, configKnown, offline, mirrorAvailable });
  const note = octaveMirrorNote({ fresh, failed, configKnown, offline });

  useEffect(() => {
    if (note !== null) noteOctaveAvailability(note);
  }, [note]);
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
