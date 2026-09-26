/**
 * Les échecs de l'API des plugins, ramenés à un motif que l'interface sait
 * dire dans la langue de l'administrateur.
 *
 * Le serveur répond en anglais technique (« Checksum verification failed… »),
 * parfois en français sans accents (la garde des archives). On reconnaît les
 * messages connus ; pour les autres, la phrase générique garde le détail brut
 * du serveur — il est souvent le seul à dire que la faute vient de la SOURCE.
 */

export class PluginApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail || (status ? `HTTP ${status}` : "Network error"));
    this.name = "PluginApiError";
  }
}

export type PluginErrorReason =
  | "network"
  | "restarting"
  | "busy"
  | "alreadyInstalled"
  | "versionGone"
  | "sourceExists"
  | "noChecksum"
  | "checksumMismatch"
  | "archiveRefused"
  | "downloadFailed"
  | "invalidRequest"
  | "notFound"
  | "session"
  | "forbidden"
  | "generic";

export interface PluginErrorDescription {
  reason: PluginErrorReason;
  /** Le message du serveur, quand la phrase traduite ne le remplace pas. */
  detail?: string;
}

export function describePluginError(error: unknown): PluginErrorDescription {
  if (!(error instanceof PluginApiError) || error.status === 0) return { reason: "network" };
  const { status, detail } = error;
  if (status === 503) return { reason: "restarting" };
  if (status === 401) return { reason: "session" };
  if (status === 403) return { reason: "forbidden" };
  if (/already running/i.test(detail)) return { reason: "busy" };
  if (/already installed/i.test(detail)) return { reason: "alreadyInstalled" };
  if (/no longer published/i.test(detail)) return { reason: "versionGone" };
  if (/source already exists/i.test(detail)) return { reason: "sourceExists" };
  if (/no sha-256 checksum/i.test(detail)) return { reason: "noChecksum" };
  if (/checksum verification failed/i.test(detail)) return { reason: "checksumMismatch" };
  if (/refused plugin archive|telechargement/i.test(detail)) return { reason: "archiveRefused", detail };
  if (/download failed/i.test(detail)) return { reason: "downloadFailed", detail };
  if (status === 400) return { reason: "invalidRequest" };
  if (status === 404) return { reason: "notFound" };
  return { reason: "generic", ...(detail ? { detail } : {}) };
}
