/**
 * L'ANNONCE du changement d'accès d'un compte connecté (docs/DROITS-UTILISATEURS.md
 * § 9.1) : désactivé, hors plage, rouvert — dit sur le canal de session
 * (`account:access`) AU MOMENT où l'état change, jamais par un relevé des clients.
 * Bloqué, le compte sort de Watch Together et ses sockets se ferment (4012) :
 * le canal de session rapporte alors la fin de sa lecture à Jellyfin.
 *
 * Trois déclencheurs, pour les SEULS comptes qui ont une socket ouverte :
 * - un minuteur posé sur le prochain bord de plage (le plus proche de tous) ;
 * - une écriture de politique faite par Tentacle (`onContentPolicyInvalidated`) ;
 * - un guet léger pour ce qui change dans le tableau de bord de Jellyfin, qui
 *   n'annonce rien (`UpdatePolicyAsync` ne publie aucun évènement, 10.11.11) :
 *   UNE lecture de `/Users` par minute, et seulement si quelqu'un est connecté.
 */

import { getContentPolicy, invalidateContentPolicy, onContentPolicyInvalidated } from "../contentPolicy";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { closeUserSockets, connectedUserIds, onPresenceChange, sendToUser } from "../wsManager";
import { leaveWatchTogetherNow } from "../watchTogether/gateway";
import { accessPolicyOf } from "./accountAccessState";
import { keepPlaybackPositions } from "./keepPositions";
import { registerLoginLockoutRepair } from "./loginLockout";
import { accountAccessOf, nextScheduleChange, sameAccountAccess } from "../../accountAccess/accountAccessRule";
import { ACCOUNT_ACCESS_CLOSE_CODE, type AccountAccessState } from "../../accountAccess/accountAccessContract";
import type { AccessScheduleDto } from "../../userRights/userRightsContract";

const WATCH_EVERY_MS = 60_000;
/** Le minuteur part un peu APRÈS le bord : la règle doit déjà voir l'autre côté. */
const EDGE_MARGIN_MS = 250;

interface Watched {
  access: AccountAccessState;
  /** Le prochain bord de plage (ms), ou null. */
  edge: number | null;
}

const watched = new Map<string, Watched>();
/** L'empreinte (désactivé, plages) vue par le guet de Jellyfin, par compte normalisé. */
const fingerprints = new Map<string, string>();
let edgeTimer: ReturnType<typeof setTimeout> | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;

const keyOf = (userId: string) => userId.replace(/-/g, "").toLowerCase();

async function announce(userId: string, access: AccountAccessState): Promise<void> {
  console.log(`[account-access] ${userId} → ${access.state}`);
  sendToUser(userId, { type: "account:access", ...access });
  if (access.state === "allowed") return;
  leaveWatchTogetherNow(userId);
  // La position d'abord : le rapport d'arrêt du compte sera refusé par Jellyfin.
  await keepPlaybackPositions(userId).catch(() => 0);
  closeUserSockets(userId, ACCOUNT_ACCESS_CLOSE_CODE, "Account access");
}

/** Relit l'accès d'un compte connecté ; l'annonce part s'il a CHANGÉ. */
export async function evaluateAccountAccess(userId: string, now = Date.now()): Promise<void> {
  const policy = await getContentPolicy(userId);
  if (!connectedUserIds().includes(userId)) return;
  const access = accountAccessOf(accessPolicyOf(policy), now);
  const edge = policy.readable ? nextScheduleChange(policy.accessSchedules, now) : null;
  const previous = watched.get(userId);
  watched.set(userId, { access, edge });
  // La référence du guet : ce que CETTE évaluation a vu, pas le prochain relevé de /Users.
  if (policy.readable) fingerprints.set(keyOf(userId), accessFingerprint(policy.isDisabled === true, policy.accessSchedules ?? []));
  if (previous && !sameAccountAccess(previous.access, access)) await announce(userId, access);
  armEdgeTimer();
}

function armEdgeTimer(): void {
  if (edgeTimer) clearTimeout(edgeTimer);
  edgeTimer = null;
  let next: number | null = null;
  for (const { edge } of watched.values()) if (edge !== null && (next === null || edge < next)) next = edge;
  if (next === null) return;
  edgeTimer = setTimeout(onEdge, Math.max(0, next - Date.now()) + EDGE_MARGIN_MS);
  edgeTimer.unref?.();
}

function onEdge(): void {
  edgeTimer = null;
  const now = Date.now();
  const due = [...watched].filter(([, entry]) => entry.edge !== null && entry.edge <= now);
  if (due.length === 0) return armEdgeTimer();
  for (const [userId] of due) void evaluateAccountAccess(userId, now).catch(() => armEdgeTimer());
}

function forget(userId: string): void {
  watched.delete(userId);
  fingerprints.delete(keyOf(userId));
  armEdgeTimer();
}

function accessFingerprint(isDisabled: boolean, schedules: readonly AccessScheduleDto[]): string {
  return JSON.stringify([isDisabled, schedules.map((entry) => [entry.dayOfWeek, entry.startHour, entry.endHour])]);
}

function rawFingerprint(policy: Record<string, unknown> | undefined): string {
  const raw = Array.isArray(policy?.AccessSchedules) ? (policy.AccessSchedules as Record<string, unknown>[]) : [];
  const schedules = raw.map((entry) => ({ dayOfWeek: entry.DayOfWeek, startHour: entry.StartHour, endHour: entry.EndHour }));
  return accessFingerprint(policy?.IsDisabled === true, schedules as AccessScheduleDto[]);
}

/** Le guet de Jellyfin : un changement fait dans son tableau de bord fait relire la politique. */
export async function watchJellyfinPolicies(): Promise<void> {
  if (watched.size === 0) return;
  const result = await jellyfinAdminFetch<{ Id?: string; Policy?: Record<string, unknown> }[]>("/Users");
  if (!result.ok || !Array.isArray(result.data)) return;
  const connected = new Set([...watched.keys()].map(keyOf));
  for (const user of result.data) {
    if (typeof user.Id !== "string" || !connected.has(keyOf(user.Id))) continue;
    const seen = fingerprints.get(keyOf(user.Id));
    // Autre chose que ce que la dernière évaluation a vu : la politique de contenu tombe,
    // les portes la relisent, et l'écouteur ci-dessous réévalue et annonce.
    if (seen !== undefined && seen !== rawFingerprint(user.Policy)) invalidateContentPolicy(user.Id);
  }
}

let registered = false;

/** Branché une fois au démarrage du serveur. */
export function registerAccountAccessWatch(): void {
  if (registered) return;
  registered = true;
  // La fiche des droits qui réactive un compte : son compteur d'essais repart de 0.
  registerLoginLockoutRepair();
  onPresenceChange((userId, online) => {
    if (online) void evaluateAccountAccess(userId).catch(() => undefined);
    else forget(userId);
  });
  onContentPolicyInvalidated((userId) => {
    for (const watchedId of watched.keys()) {
      if (userId === null || keyOf(watchedId) === userId) void evaluateAccountAccess(watchedId).catch(() => undefined);
    }
  });
  watchTimer = setInterval(() => void watchJellyfinPolicies().catch(() => undefined), WATCH_EVERY_MS);
  watchTimer.unref?.();
}

export function resetAccountAccessWatchForTests(): void {
  watched.clear();
  fingerprints.clear();
  if (edgeTimer) clearTimeout(edgeTimer);
  if (watchTimer) clearInterval(watchTimer);
  edgeTimer = null;
  watchTimer = null;
  registered = false;
}
