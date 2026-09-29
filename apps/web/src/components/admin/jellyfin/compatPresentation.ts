import {
  compareJellyfinVersions,
  type CompatFeatureView,
  type CompatStatus,
  type CompatVersionView,
  type JellyfinCompatReport,
  type LocalizedText,
} from "@tentacle-tv/shared";
import type { StatusTone } from "../kit";

/**
 * Ce que la page dit d'un verdict de compatibilité — en logique pure : le ton
 * et le mot de chaque état, l'explication (clé i18n et valeurs), ce qui
 * manque, ce que les sondes ont confirmé, et la situation de la dernière
 * version publiée par rapport à l'installée.
 */

export const COMPAT_TONE: Record<CompatStatus, StatusTone> = {
  compatible: "success",
  partial: "warning",
  presumed: "info",
  untested: "neutral",
  incompatible: "error",
};

export const COMPAT_LABEL: Record<CompatStatus, string> = {
  compatible: "statusCompatible",
  partial: "statusPartial",
  presumed: "statusPresumed",
  untested: "statusUntested",
  incompatible: "statusIncompatible",
};

/** Le texte du manifeste dans la langue de l'interface. */
export const localized = (text: LocalizedText, language: string): string =>
  language.toLowerCase().startsWith("fr") ? text.fr : text.en;

/** « 29 sept. 2026 » / « Sep 29, 2026 ». */
export function formatDay(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** « 29 sept., 13:48 » : le passage d'une tâche se lit à l'heure près. */
export function formatMoment(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

const GAP_STATES: ReadonlySet<string> = new Set(["partial", "fail", "unsupported"]);

/** Ce qui manque ou cloche : les fonctionnalités partielles, en échec ou refusées. */
export const gapsOf = (view: CompatVersionView): CompatFeatureView[] => view.features.filter((f) => GAP_STATES.has(f.state));

export interface ProbeSummary {
  checked: number;
  present: number;
  missing: CompatFeatureView[];
}

/** Les capacités sondées sur le serveur connecté ; `null` si rien n'avait d'endpoint à chercher. */
export function probeSummary(view: CompatVersionView): ProbeSummary | null {
  const probed = view.features.filter((feature) => feature.probe !== null);
  if (probed.length === 0) return null;
  const missing = probed.filter((feature) => feature.probe?.state === "missing");
  return { checked: probed.length, present: probed.length - missing.length, missing };
}

export interface Explanation {
  key: string;
  values?: Record<string, string | number>;
  /** Des valeurs qui sont elles-mêmes des clés à traduire. */
  nested?: Record<string, string>;
}

/** Pourquoi ce verdict, en une phrase. */
export function explainVerdict(view: CompatVersionView, language: string): Explanation {
  if (view.reason === "below-minimum") return { key: "explainBelowMinimum" };
  switch (view.status) {
    case "compatible":
      return view.basis?.ranAt
        ? { key: "explainCompatible", values: { date: formatDay(view.basis.ranAt, language) } }
        : { key: "explainCompatibleNoDate" };
    case "partial":
      return { key: "explainPartial", values: { count: gapsOf(view).length } };
    case "incompatible":
      return { key: "explainIncompatible" };
    case "presumed":
      return {
        key: "explainPresumed",
        values: { basis: view.basis?.version ?? "" },
        nested: { basisStatus: view.basis?.verdict === "partial" ? "basisPartial" : "basisOk" },
      };
    case "untested":
      return view.basis ? { key: "explainUntestedSibling", values: { basis: view.basis.version } } : { key: "explainUntested" };
  }
}

/** La dernière version publiée, vue depuis l'installée. */
export type LatestSituation = "update" | "current" | "ahead" | "unknown";

export function latestSituation(report: JellyfinCompatReport): LatestSituation {
  const { latest, installed } = report;
  if (!latest || !installed) return "unknown";
  if (latest.newer) return "update";
  return compareJellyfinVersions(installed.version, latest.version) > 0 ? "ahead" : "current";
}

/** La clé qui dit pourquoi la version installée manque. */
export const INSTALLED_FAILURE_KEY = {
  "not-configured": "installedNotConfigured",
  unreachable: "installedUnreachable",
  rejected: "installedRejected",
  invalid: "installedInvalid",
} as const;
