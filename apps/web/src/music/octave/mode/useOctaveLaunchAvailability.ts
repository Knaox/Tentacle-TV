/**
 * Octave — la disponibilité telle que le LANCEMENT et le MODE la lisent : celle
 * du serveur (`useOctaveAvailability`, la porte d'accès) dès qu'elle est
 * établie ; avant, le miroir de la dernière réponse pour ce compte
 * (`octaveLaunch.ts`) — la page d'Octave se peint sans attendre la
 * configuration ni le statut de la musique, puis la réponse du serveur tranche
 * (sans musique : Tentacle, sans erreur).
 *
 * Une PANNE n'est jamais une absence (`octaveModeAvailability`, règle partagée
 * `octaveStay.ts`) : hors ligne, configuration finie sans réponse, statut en
 * erreur — Octave reste disponible, et rien n'entre dans le miroir
 * (`octaveMirrorNote`) : seule une RÉPONSE établie est retenue pour le
 * lancement suivant.
 */

import { useEffect, useMemo } from "react";
import { useMusicStatus, useServerCapabilities } from "@tentacle-tv/api-client";
import { octaveMirrorNote } from "@tentacle-tv/shared/octave/mode";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { octaveOwner } from "../cache/octaveOwner";
import { launchAvailability } from "./octaveLaunch";
import { launchOctaveMirror, noteOctaveAvailability } from "./octaveLaunchStore";
import { octaveModeAvailability } from "./octaveModeAvailability";
import { useOctaveAvailability, type OctaveAvailability } from "./useOctaveAvailability";

export function useOctaveLaunchAvailability(enabled = true): OctaveAvailability {
  const fresh = useOctaveAvailability(enabled);
  const owner = useMemo(octaveOwner, []);
  const failed = useMusicStatus().isError;
  const configKnown = useServerCapabilities().known;
  const offline = useOfflineMode();
  const note = enabled ? octaveMirrorNote({ fresh, failed, configKnown, offline }) : null;
  useEffect(() => {
    if (note !== null) noteOctaveAvailability(note);
  }, [note]);
  if (!enabled) return fresh;
  const mirror = launchOctaveMirror();
  return octaveModeAvailability({
    fresh: launchAvailability(fresh, owner, mirror),
    failed,
    configKnown,
    offline,
    mirrorAvailable: owner !== null && mirror?.owner === owner && mirror.available,
  });
}
