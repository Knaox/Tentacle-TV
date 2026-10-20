import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import {
  buildProblemDiagnostic, createProblemJournal,
  type PlaybackDiagnostic, type ProblemEnvironment, type ProblemModel, type ProblemReport,
} from "@tentacle-tv/shared";

/**
 * Le journal LOCAL des erreurs du mobile et de la tablette — la règle est
 * dans shared (`problemJournal.ts`, `problemDiagnostics.ts`) ; ici, son
 * stockage (AsyncStorage) et ce que l'appareil sait de lui-même. Chaque
 * message montré (bandeau, carte du lecteur, écran plein, écran qui plante)
 * y est noté ; rien ne quitte l'appareil sans « Signaler un problème ».
 * API du futur bouton : `attachProblemReport()` — docs/lot-mobile-1020/erreurs.md.
 */

/** Clé de stockage : elle traverse les versions, elle ne se renomme jamais. */
export const PROBLEM_JOURNAL_KEY = "tentacle_problem_journal";

const journal = createProblemJournal({
  storage: {
    load: () => AsyncStorage.getItem(PROBLEM_JOURNAL_KEY),
    save: (serialized) => AsyncStorage.setItem(PROBLEM_JOURNAL_KEY, serialized),
  },
});
let hydrated: Promise<void> | null = null;

function formFactor(): string {
  if (Device.deviceType === Device.DeviceType.TABLET) return "tablet";
  if (Device.deviceType === Device.DeviceType.PHONE) return "phone";
  return Platform.OS === "ios" && Platform.isPad ? "tablet" : "phone";
}

let serverVersion: string | undefined;
let playback: PlaybackDiagnostic | undefined;
let currentScreen: string | undefined;

/** La version du serveur Tentacle, posée dès que `/api/config` l'a dite. */
export function setProblemServerVersion(version: string | null | undefined): void {
  serverVersion = version ?? undefined;
}

/**
 * La lecture en cours (moteur, décision, session) — posée par le lecteur,
 * retirée à sa sortie (`null`). Les champs donnés remplacent les précédents.
 */
export function setPlaybackDiagnostic(next: PlaybackDiagnostic | null): void {
  playback = next === null ? undefined : { ...playback, ...next };
}

export function problemEnvironment(): ProblemEnvironment {
  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    formFactor: formFactor(),
    appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? undefined,
    appBuild: Application.nativeBuildVersion ?? undefined,
    serverVersion,
  };
}

/** Relire le journal du stockage — une fois, au démarrage. */
export function hydrateProblemJournal(): Promise<void> {
  hydrated ??= journal.hydrate();
  return hydrated;
}

export interface RecordOptions {
  /** Les lignes des détails, déjà traduites. */
  detailLines?: string[];
  /** L'écran (chemin de route) où le message s'est montré. */
  screen?: string;
}

/** Noter un message montré. Jamais d'exception : le journal n'est qu'une aide. */
export function recordProblem(model: Pick<ProblemModel, "code" | "severity" | "details">, options: RecordOptions = {}): void {
  try {
    const isPlayback = model.code.startsWith("playback") || model.code.startsWith("offlinePlayback") || model.code.startsWith("cast");
    journal.record(buildProblemDiagnostic({
      model,
      environment: problemEnvironment(),
      detailLines: options.detailLines,
      screen: options.screen ?? currentScreen,
      playback: isPlayback ? playback : undefined,
    }));
  } catch {
    // rien : un message doit pouvoir se montrer même si le journal casse.
  }
}

/** L'écran courant, suivi par la racine (`ProblemJournalBinding`). */
export function setProblemScreen(pathname: string): void {
  currentScreen = pathname;
}

/**
 * Le rapport que « Signaler un problème » joindra : l'environnement de
 * maintenant et les dernières erreurs, la plus récente d'abord. Attend la
 * relecture du stockage, pour ne rien oublier d'une session précédente.
 */
export async function attachProblemReport(limit?: number): Promise<ProblemReport> {
  await hydrateProblemJournal();
  return journal.attach(problemEnvironment(), limit);
}

/** Vider le journal (réglage « Effacer », déconnexion du compte). */
export function clearProblemJournal(): void {
  journal.clear();
}
