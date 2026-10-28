/**
 * Octave (mobile) — le registre réuni : les écrans et morceaux de coquille de
 * tous les axes. Un écran branché deux fois : le dernier gagne (ordre des axes).
 */

import type { ComponentType, ReactNode } from "react";
import { m2Contribution } from "./axes/m2";
import { m3Contribution } from "./axes/m3";
import { m4Contribution } from "./axes/m4";
import { m5Contribution } from "./axes/m5";
import { m7Contribution } from "./axes/m7";
import type { OctaveAxisContribution, OctaveMiniPlayerProps, OctaveScreenName, OctaveScreenProps } from "./octaveRegistryTypes";

const AXES: readonly OctaveAxisContribution[] = [m2Contribution, m3Contribution, m4Contribution, m5Contribution, m7Contribution];

const screens: Partial<Record<OctaveScreenName, ComponentType<OctaveScreenProps>>> = Object.assign({}, ...AXES.map((axis) => axis.screens ?? {}));

export function octaveScreen(name: OctaveScreenName): ComponentType<OctaveScreenProps> | null {
  return screens[name] ?? null;
}

export const octaveMiniPlayer: ComponentType<OctaveMiniPlayerProps> | null = AXES.reduce<ComponentType<OctaveMiniPlayerProps> | null>((found, axis) => axis.miniPlayer ?? found, null);

export const octaveOverlays: readonly ComponentType[] = AXES.flatMap((axis) => axis.overlays ?? []);

export const octaveProviders: readonly ComponentType<{ children: ReactNode }>[] = AXES.flatMap((axis) => axis.providers ?? []);
