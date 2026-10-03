/**
 * Les avertissements surgissants des clients (web, bureau, mobile, iPad) —
 * UNE politique, que chaque plateforme ne fait que rendre.
 *
 * - **Gravité.** `blocking` : une panne que seul un geste répare — il reste
 *   jusqu'à ce qu'on le ferme, et ne se masque jamais pour de bon ;
 *   `recommendation` : quelque chose gagnerait à être réglé ; `info` : à
 *   savoir. Une recommandation ou une info s'efface SEULE après
 *   `NOTICE_AUTO_HIDE_MS` — le décompte s'arrête tant qu'on la touche ou
 *   qu'on la survole. Effacé ou fermé, un avertissement ne revient pas de la
 *   session (le lancement suivant le redira si sa cause tient).
 * - **Public.** Ce que seul un administrateur peut corriger ne s'affiche
 *   qu'aux administrateurs. Un spectateur n'est averti que d'une fonction
 *   dégradée, là où il la cherche (le rappel des bandes-annonces sur la fiche,
 *   une erreur expliquée au geste) — jamais par une fenêtre au démarrage.
 * - **« Ne plus afficher ».** Une préférence du COMPTE (rappels de
 *   `/api/preferences/hints`, liste fermée `help/dismissibleHints.ts`),
 *   jamais une clé d'appareil — offerte seulement si le serveur sait la
 *   retenir (`known`).
 * - **Un seul à la fois**, le premier par rang ; jamais sur le lecteur ni sur
 *   la barre d'onglets (c'est le rendu qui le garantit).
 * - **Silence là où le tableau de bord le dit déjà** : la vue d'ensemble de
 *   l'administration (`/admin`, la page exacte) montre durablement la clé
 *   d'administration, TMDB et le serveur ; la page qui règle un problème le
 *   tait aussi (`suppressedNotices`).
 */

import type { DismissibleHint } from "../help/dismissibleHints";

export type NoticeSeverity = "blocking" | "recommendation" | "info";
export type NoticeAudience = "admins" | "everyone";

/** Les avertissements surgissants connus. */
export type NoticeId = "serverUpdate" | "tmdbKey" | "adminKey";

export interface NoticeRule {
  id: NoticeId;
  severity: NoticeSeverity;
  audience: NoticeAudience;
  /** Le rappel du compte qui le masque « pour de bon » ; `null` : jamais masquable. */
  hint: DismissibleHint | null;
  /**
   * Ce que vaut le masquage : `forever` (jusqu'à ce que le compte le
   * réaffiche), `untilHigherRequirement` (sa marque retient une exigence :
   * cf. `serverUpdateNotice.ts`).
   */
  dismissScope: "forever" | "untilHigherRequirement" | null;
}

/** Le temps de lecture d'une recommandation, avant qu'elle ne s'efface seule. */
export const NOTICE_AUTO_HIDE_MS = 6000;

/**
 * Par ordre de priorité : un seul se montre à la fois.
 * - `adminKey` : la clé d'administration Jellyfin manque ou n'a plus ses
 *   droits — des fonctions du serveur sont en panne pour TOUS les comptes ;
 * - `serverUpdate` : le serveur est plus ancien que ce client n'exige ;
 * - `tmdbKey` : sans clé TMDB, les recommandations restent génériques.
 */
export const NOTICE_RULES: readonly NoticeRule[] = [
  { id: "adminKey", severity: "blocking", audience: "admins", hint: null, dismissScope: null },
  { id: "serverUpdate", severity: "recommendation", audience: "admins", hint: "serverUpdate", dismissScope: "untilHigherRequirement" },
  { id: "tmdbKey", severity: "recommendation", audience: "admins", hint: "tmdbKey", dismissScope: "forever" },
];

export function noticeRule(id: NoticeId): NoticeRule {
  const rule = NOTICE_RULES.find((entry) => entry.id === id);
  if (!rule) throw new Error(`avertissement inconnu : ${id}`);
  return rule;
}

/** S'efface-t-il seul, et après combien de temps ? `null` : il reste. */
export function noticeAutoHideMs(severity: NoticeSeverity): number | null {
  return severity === "blocking" ? null : NOTICE_AUTO_HIDE_MS;
}

export interface NoticeCandidate {
  id: NoticeId;
  /** Sa condition tient (le serveur est en retard, la clé manque…) et le compte ne l'a pas masqué. */
  active: boolean;
}

export interface NoticeContext {
  isAdmin: boolean;
  /** Ce qui s'est effacé seul ou a été fermé pendant cette session. */
  closedThisSession: ReadonlySet<NoticeId>;
  /** La page qui règle le problème est ouverte : inutile de le redire. */
  suppressed?: ReadonlySet<NoticeId>;
}

/** Peut-il se montrer à ce compte, maintenant ? */
export function noticeAllowed(rule: NoticeRule, context: NoticeContext): boolean {
  if (rule.audience === "admins" && !context.isAdmin) return false;
  if (context.suppressed?.has(rule.id)) return false;
  return !context.closedThisSession.has(rule.id);
}

/** L'avertissement à montrer maintenant — un seul, le premier par rang. */
export function pickNotice(candidates: readonly NoticeCandidate[], context: NoticeContext): NoticeId | null {
  for (const rule of NOTICE_RULES) {
    const candidate = candidates.find((entry) => entry.id === rule.id);
    if (candidate?.active && noticeAllowed(rule, context)) return rule.id;
  }
  return null;
}

/** La page qui RÈGLE chaque avertissement : il s'y tait. */
const FIXING_PAGES: readonly { prefix: string; ids: readonly NoticeId[] }[] = [
  { prefix: "/admin/metadata", ids: ["tmdbKey"] },
  { prefix: "/admin/services", ids: ["adminKey"] },
];

/** Le tableau de bord, qui les montre tous durablement (la page exacte). */
const DASHBOARD_PATHS: ReadonlySet<string> = new Set(["/admin", "/admin/"]);

/** Les avertissements à taire sur cette page (chemin du routeur, sans requête). */
export function suppressedNotices(pathname: string): Set<NoticeId> {
  if (DASHBOARD_PATHS.has(pathname)) return new Set(NOTICE_RULES.map((rule) => rule.id));
  const ids = new Set<NoticeId>();
  for (const page of FIXING_PAGES) {
    if (pathname === page.prefix || pathname.startsWith(`${page.prefix}/`)) page.ids.forEach((id) => ids.add(id));
  }
  return ids;
}

/** « Ne plus afficher » est-il offert ? Seulement si le serveur sait le retenir. */
export function canDismissForGood(rule: NoticeRule, knownHints: readonly DismissibleHint[] | undefined): boolean {
  return rule.hint !== null && !!knownHints?.includes(rule.hint);
}
