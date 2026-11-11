import type { UpdateInfo } from "../../lib/updateTypes";
import type { DebugChoice } from "./debugActionTypes";
import type { DebugShellKind } from "./debugShell";

/**
 * La pop-up de mise à jour, POUR DE FAUX — et chaque coquille a la sienne :
 *
 *  - Electron (et le web de développement) : la pop-up du front (`UpdateDialog`), par le crochet
 *    `window.__tentacleSimulateUpdate` de `useAutoUpdate` — on lui pose une phase pour la
 *    REGARDER ; son bouton agit pour de vrai (sur macOS il ouvre la fiche de l'App Store).
 *  - CEF : la surcouche de la COQUILLE (`apps/desktop-cef/web/shim/update-overlay.js`), que le
 *    front ne connaît pas. Elle écoute l'évènement de fenêtre `tentacle:update-demo` et montre
 *    alors un instantané FACTICE, sans rien demander au natif : ses boutons referment la
 *    démonstration, « Redémarrer » joue le voile d'installation trois secondes. Avant le lot
 *    rf2, cette entrée ouvrait sous CEF la pop-up d'Electron (« Ouvrir l'App Store ») — une
 *    pop-up que CEF ne montre jamais.
 *
 * ⚠️ `tentacle:update-demo` traverse deux programmes (la page et la coquille) : il ne se
 * renomme pas d'un seul côté.
 */

export const UPDATE_DEMO_EVENT = "tentacle:update-demo";

const DEMO_VERSION = "9.9.9";
const NOTES = {
  fr: "• Démonstration du menu de débogage\n• Aucune mise à jour ne sera installée\n• Les boutons referment cette démonstration",
  en: "• Debug menu demonstration\n• Nothing will be installed\n• The buttons close this demonstration",
};

/** Les instantanés que la surcouche CEF sait montrer (la forme de `update.state`). */
const CEF_SNAPSHOTS: Record<string, Record<string, unknown>> = {
  toast: { prompt: "toast", phase: "downloading", progress: 0.42, canMute: true, update: { version: DEMO_VERSION, notes: NOTES, install: true } },
  ready: { prompt: "toast", phase: "ready", canMute: true, update: { version: DEMO_VERSION, notes: NOTES, install: true } },
  security: { prompt: "blocking", phase: "downloading", progress: 0.6, update: { version: DEMO_VERSION, mandatory: true, install: true } },
  applying: { prompt: "toast", phase: "applying", update: { version: DEMO_VERSION, install: true } },
  rolledBack: { prompt: "none", phase: "idle", rolledBack: DEMO_VERSION, update: {} },
};

const CEF_CHOICES: readonly DebugChoice[] = [
  { id: "toast", label: "Notification" },
  { id: "ready", label: "Prête" },
  { id: "security", label: "Sécurité" },
  { id: "applying", label: "Installation" },
  { id: "rolledBack", label: "Annulée" },
  { id: "close", label: "Fermer" },
];

/** Les phases que la pop-up du front sait montrer (un état posé, `useAutoUpdate`). */
const FRONT_OVERRIDES: Record<string, Partial<UpdateInfo>> = {
  available: {},
  downloading: { phase: "downloading", downloading: true, indeterminate: true },
  installing: { phase: "installing", downloading: true, progress: 100 },
  restarting: { phase: "restarting", downloading: true, progress: 100 },
  error: { error: "Démonstration : le téléchargement a échoué." },
};

const FRONT_CHOICES: readonly DebugChoice[] = [
  { id: "available", label: "Disponible" },
  { id: "downloading", label: "Téléchargement" },
  { id: "installing", label: "Installation" },
  { id: "restarting", label: "Redémarrage" },
  { id: "error", label: "Erreur" },
];

const cefChoice = (c: DebugChoice): DebugChoice => ({ id: `shell:${c.id}`, label: c.label });
const frontChoice = (c: DebugChoice, prefix: string): DebugChoice => ({ id: `front:${c.id}`, label: `${prefix}${c.label}` });

/**
 * Les variantes offertes par CETTE coquille.
 *  - Electron, navigateur : la pop-up du front.
 *  - CEF : sa surcouche — et, là où la coquille confie AUSSI une mise à jour au front
 *    (`frontToo` : Windows, le paquet MSIX que le Microsoft Store met à jour par
 *    `check_msix_update`), la pop-up du front en plus, préfixée « Store · ».
 */
export function updateDemoChoices(kind: DebugShellKind, frontToo: boolean): readonly DebugChoice[] {
  if (kind !== "cef") return FRONT_CHOICES.map((c) => frontChoice(c, ""));
  return [...CEF_CHOICES.map(cefChoice), ...(frontToo ? FRONT_CHOICES.map((c) => frontChoice(c, "Store · ")) : [])];
}

/** La surcouche de la coquille CEF écoute-t-elle ? (elle pose ce drapeau en s'installant) */
export function cefUpdateDemoReady(): boolean {
  return (window as unknown as { __tentacleUpdateDemo?: boolean }).__tentacleUpdateDemo === true;
}

function frontHook(): ((override?: Partial<UpdateInfo>) => void) | null {
  const hook = (window as unknown as { __tentacleSimulateUpdate?: (override?: Partial<UpdateInfo>) => void }).__tentacleSimulateUpdate;
  return typeof hook === "function" ? hook : null;
}

/** Pourquoi la démonstration ne peut pas se jouer ici, ou `undefined`. */
export function updateDemoUnavailable(kind: DebugShellKind): string | undefined {
  if (kind === "cef") return cefUpdateDemoReady() ? undefined : "surcouche CEF sans démonstration : reconstruire la coquille (pnpm cef)";
  return frontHook() ? undefined : "pop-up de mise à jour non montée sur cette page";
}

export function runUpdateDemo(kind: DebugShellKind, choice: string | undefined): string {
  const [family, id] = (choice ?? (kind === "cef" ? "shell:toast" : "front:available")).split(":") as [string, string];
  if (family === "front") {
    const simulate = frontHook();
    if (!simulate) return "pop-up de mise à jour non montée sur cette page";
    simulate(FRONT_OVERRIDES[id] ?? {});
    return `pop-up de mise à jour : ${FRONT_CHOICES.find((c) => c.id === id)?.label ?? id}${id === "available" ? " — le bouton agit pour de vrai" : ""}`;
  }
  if (!cefUpdateDemoReady()) return "surcouche CEF sans démonstration : reconstruire la coquille (pnpm cef)";
  const snapshot = id === "close" ? null : CEF_SNAPSHOTS[id] ?? CEF_SNAPSHOTS.toast;
  window.dispatchEvent(new CustomEvent(UPDATE_DEMO_EVENT, { detail: { snapshot } }));
  if (snapshot === null) return "démonstration de mise à jour refermée";
  const quiet = id === "toast" || id === "ready" || id === "rolledBack";
  const waits = quiet && window.location.pathname.startsWith("/watch");
  return `surcouche CEF : ${CEF_CHOICES.find((c) => c.id === id)?.label ?? id}${waits ? " — elle ATTEND la fin de la lecture pour paraître" : ""}${quiet ? "" : " — voile bloquant, refermé seul après 6 s"}`;
}
