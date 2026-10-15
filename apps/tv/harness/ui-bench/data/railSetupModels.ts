import { i18n } from "@tentacle-tv/shared";
import { libraryIdOf } from "@tentacle-tv/tv-core";
import type { RailPreviewEntry, RailSetupModel, RailSetupTarget } from "../../../src/redesign/screens/railSetup/railSetupTypes";
import type { BenchData } from "./benchData";
import { benchMovable } from "./navModels";

/**
 * La préconfiguration de la barre au banc, comme l'intégration la compose
 * (`redesignWiring/railSetup`) : les bibliothèques du compte (de quoi en
 * avoir autant qu'on veut), épinglées sauf celles qu'on dit, et l'aperçu —
 * Rechercher, Accueil, puis ce qui reste affiché, dans l'ordre.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

export interface BenchRailSetupOptions {
  libraries?: number;
  /** Les bibliothèques retirées de la barre (clés `Library_…`). */
  unpinned?: string[];
  order?: string[];
  movingKey?: string | null;
  profileName?: string | null;
}

export function benchRailSetup(data: BenchData, options: BenchRailSetupOptions = {}): Extract<RailSetupModel, { kind: "libraries" }> {
  const unpinned = new Set(options.unpinned ?? []);
  const movable = benchMovable(data, { libraries: options.libraries, order: options.order });
  const libraries = movable
    .filter((entry) => libraryIdOf(entry.key) !== null)
    .map((entry) => ({ ...entry, pinned: !unpinned.has(entry.key) }));
  const preview: RailPreviewEntry[] = [
    { key: "Search", label: t("nav:search"), icon: "search" },
    { key: "Home", label: t("nav:home"), icon: "home" },
    ...movable.filter((entry) => !unpinned.has(entry.key)),
  ];
  return {
    kind: "libraries",
    profileName: options.profileName ?? null,
    libraries,
    movingKey: options.movingKey ?? null,
    preview,
  };
}

/** Les autres profils d'une famille de banc : Léa, Tom (déjà configuré), Mamie (invitée). */
export function benchRailSetupTargets(selected: string[] = []): RailSetupTarget[] {
  const targets: Omit<RailSetupTarget, "selected">[] = [
    { userId: "lea", name: "Léa", color: "pink", setupDone: false },
    { userId: "tom", name: "Tom", color: "teal", setupDone: true },
    { userId: "mamie", name: "Mamie", color: "amber", setupDone: false },
  ];
  return targets.map((target) => ({ ...target, selected: selected.includes(target.userId) }));
}
