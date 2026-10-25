/**
 * Octave — la disponibilité telle que le LANCEMENT la lit : celle du serveur
 * (`useOctaveAvailability`, la porte d'accès) dès qu'elle est établie ; avant,
 * le miroir de la dernière réponse pour ce compte (`octaveLaunch.ts`) — la
 * page d'Octave se peint sans attendre la configuration ni le statut de la
 * musique, puis la réponse du serveur tranche (sans musique : Tentacle, sans
 * erreur). Chaque RÉPONSE établie (jamais une panne) est retenue pour le
 * lancement suivant.
 */

import { useEffect, useMemo } from "react";
import { useMusicStatus } from "@tentacle-tv/api-client";
import { octaveOwner } from "../cache/octaveOwner";
import { launchAvailability } from "./octaveLaunch";
import { launchOctaveMirror, noteOctaveAvailability } from "./octaveLaunchStore";
import { useOctaveAvailability, type OctaveAvailability } from "./useOctaveAvailability";

export function useOctaveLaunchAvailability(enabled = true): OctaveAvailability {
  const fresh = useOctaveAvailability(enabled);
  const owner = useMemo(octaveOwner, []);
  const { available, settled } = fresh;
  // Une panne (statut en erreur, hors ligne) n'est pas une absence : le miroir n'apprend que des réponses.
  const failed = useMusicStatus().isError;
  useEffect(() => {
    if (enabled && settled && !failed) noteOctaveAvailability(available);
  }, [enabled, available, settled, failed]);
  return enabled ? launchAvailability(fresh, owner, launchOctaveMirror()) : fresh;
}
