import {
  canDismissForGood, isAdminKeyBroken, noticeRule, pickNotice, serverUpdateNotice,
  type AdminKeyState, type NoticeCandidate, type NoticeId, type NoticeRule,
} from "@tentacle-tv/shared";
import { useAdminKeyHealth } from "../hooks/useAdminKeyHealth";
import { useAdminMetadataStatus } from "../hooks/useAdminMetadata";
import { useDismissedHints, type DismissedHintsState } from "../hooks/useDismissedHints";
import { useClosedNotices } from "./noticeSession";

/** Ce que la plateforme apporte : le compte, la version du serveur, son exigence, la page. */
export interface ClientNoticeInput {
  isAdmin: boolean;
  /** `/api/config` → `version` ; `null` faute de réponse (rien n'est deviné). */
  serverVersion: string | null;
  /** L'exigence de CE client (`versions.json` → `minServer`, posée au build). */
  minServer: string;
  /** Les avertissements à taire sur la page courante (`suppressedNotices`). */
  suppressed?: ReadonlySet<NoticeId>;
}

export interface ClientNotice {
  id: NoticeId;
  rule: NoticeRule;
  /** Les valeurs des phrases (versions). */
  values: Record<string, string>;
  /** « Ne plus afficher » est offert : le serveur sait le retenir. */
  canDismiss: boolean;
  /** Ce que le masquage retient (`serverUpdate` : l'exigence en vigueur). */
  mark?: string;
  /** La panne de la clé d'administration, pour la dire précisément. */
  adminKeyState?: AdminKeyState;
}

/** Le masquage d'un rappel : `undefined` tant qu'il n'est pas lu, `null` s'il n'y en a pas, sinon sa marque. */
function dismissalOf(hints: DismissedHintsState | undefined, hint: "serverUpdate" | "tmdbKey"): string | null | undefined {
  if (!hints) return undefined;
  return hints.dismissed.includes(hint) ? hints.marks[hint] ?? "" : null;
}

/** Ce que les requêtes du compte ont appris (`undefined` : pas encore). */
export interface ClientNoticeData {
  hints: DismissedHintsState | undefined;
  tmdbConfigured: boolean | undefined;
  adminKeyState: AdminKeyState | null | undefined;
  closedThisSession: ReadonlySet<NoticeId>;
}

/** La décision, pure : testée sans React. */
export function clientNoticeOf(input: ClientNoticeInput, data: ClientNoticeData): ClientNotice | null {
  const { isAdmin } = input;
  const server = serverUpdateNotice({
    serverVersion: input.serverVersion, minServer: input.minServer, isAdmin, dismissal: dismissalOf(data.hints, "serverUpdate"),
  });
  const candidates: NoticeCandidate[] = [
    { id: "adminKey", active: isAdminKeyBroken(data.adminKeyState) },
    { id: "serverUpdate", active: server.show },
    { id: "tmdbKey", active: data.tmdbConfigured === false && dismissalOf(data.hints, "tmdbKey") === null },
  ];
  const id = pickNotice(candidates, { isAdmin, closedThisSession: data.closedThisSession, suppressed: input.suppressed });
  if (!id) return null;
  const rule = noticeRule(id);
  return {
    id,
    rule,
    values: { server: input.serverVersion ?? "?", required: input.minServer },
    canDismiss: canDismissForGood(rule, data.hints?.known),
    mark: id === "serverUpdate" ? server.mark : undefined,
    adminKeyState: id === "adminKey" ? data.adminKeyState ?? undefined : undefined,
  };
}

/**
 * L'avertissement surgissant à montrer MAINTENANT — un seul, selon la
 * politique partagée (`notices/noticePolicy.ts`) : la clé d'administration,
 * le serveur à mettre à jour, la clé TMDB. Administrateurs seulement ; rien
 * tant que les rappels du compte ne sont pas lus. Même décision pour le web,
 * le bureau, le mobile et l'iPad : chaque plateforme ne fait que le rendre.
 */
export function useClientNotice(input: ClientNoticeInput): ClientNotice | null {
  const closedThisSession = useClosedNotices();
  const { data: hints } = useDismissedHints({ enabled: input.isAdmin });
  const { data: metadata } = useAdminMetadataStatus({ enabled: input.isAdmin });
  const { data: adminKey } = useAdminKeyHealth({ enabled: input.isAdmin });
  return clientNoticeOf(input, {
    hints, tmdbConfigured: metadata?.tmdb.configured, adminKeyState: adminKey?.state, closedThisSession,
  });
}
