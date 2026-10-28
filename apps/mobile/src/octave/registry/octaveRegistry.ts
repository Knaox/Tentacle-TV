/**
 * Octave (mobile) — le registre réuni : les écrans et morceaux de coquille de
 * tous les axes, chacun avec son droit (`OctaveRequirement`). Un écran branché
 * deux fois : le dernier gagne (ordre des axes).
 */

import type { ComponentType, ReactNode } from "react";
import { m2Contribution } from "./axes/m2";
import { m3Contribution } from "./axes/m3";
import { m4Contribution } from "./axes/m4";
import { m5Contribution } from "./axes/m5";
import { m7Contribution } from "./axes/m7";
import { o2Contribution } from "./axes/o2";
import { gatedEntry } from "./octaveRequirement";
import type { OctaveAxisContribution, OctaveMiniPlayerProps, OctaveRequirement, OctaveScreenName, OctaveScreenProps } from "./octaveRegistryTypes";

export interface OctaveEntry<T> {
  component: T;
  requires?: OctaveRequirement;
}

const AXES: readonly OctaveAxisContribution[] = [m2Contribution, m3Contribution, m4Contribution, m5Contribution, m7Contribution, o2Contribution];

const screens = new Map<OctaveScreenName, OctaveEntry<ComponentType<OctaveScreenProps>>>();
for (const axis of AXES) {
  for (const [name, entry] of Object.entries(axis.screens ?? {})) {
    const gated = gatedEntry(entry);
    if (gated) screens.set(name as OctaveScreenName, gated);
  }
}

/** L'écran branché pour `name` et son droit ; null : pas encore branché (page d'attente). */
export function octaveScreen(name: OctaveScreenName): OctaveEntry<ComponentType<OctaveScreenProps>> | null {
  return screens.get(name) ?? null;
}

export const octaveMiniPlayer: OctaveEntry<ComponentType<OctaveMiniPlayerProps>> | null = AXES.reduce<OctaveEntry<ComponentType<OctaveMiniPlayerProps>> | null>(
  (found, axis) => gatedEntry(axis.miniPlayer) ?? found,
  null,
);

export const octaveOverlays: readonly OctaveEntry<ComponentType>[] = AXES.flatMap((axis) => (axis.overlays ?? []).map((entry) => gatedEntry(entry)).filter((e): e is OctaveEntry<ComponentType> => e !== null));

export const octaveProviders: readonly ComponentType<{ children: ReactNode }>[] = AXES.flatMap((axis) => axis.providers ?? []);
