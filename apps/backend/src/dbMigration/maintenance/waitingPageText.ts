/**
 * Les mots de la page d'attente du SERVEUR (FR/EN). Le backend ne dépend pas de
 * `@tentacle-tv/shared` (image sans packages/) : ils sont ici, et les mêmes
 * phrases vivent dans l'espace i18n `errors` des clients (`dbMigration*`).
 * Aucun détail technique : un motif d'échec choisit UNE phrase de cette liste.
 */
export type WaitingLang = "fr" | "en";

export const WAITING_TEXT = {
  fr: {
    title: "Migration de la base de données en cours",
    body: "Tentacle passe à une base plus légère. L'opération peut prendre quelques minutes.",
    tables: "{done} tables sur {total}",
    etaMinutes: "Environ {n} min restantes",
    etaSoon: "Moins d'une minute restante",
    etaUnknown: "Estimation du temps restant…",
    footer: "Cette page se met à jour toute seule : Tentacle revient dès la fin.",
    failedTitle: "La migration n'a pas abouti",
    failedBody: "Vos données sont intactes : l'ancienne base n'a pas été modifiée.",
    retryIn: "Nouvel essai automatique dans {time}.",
    retryNow: "Nouvel essai en cours…",
    rollback: "Revenir à la version précédente : redéployez l'image d'avant (par exemple ghcr.io/knaox/tentacle-tv:v1.24.0). Elle repart sur votre base intacte.",
    reasons: {
      source_unreachable: "L'ancienne base ne répond pas. Vérifiez qu'elle est démarrée et joignable par Tentacle.",
      source_config: "Un réglage de connexion à l'ancienne base n'est pas compris. Le journal du serveur dit lequel.",
      source_too_old: "Cette installation est trop ancienne pour passer directement à cette version : installez d'abord la version 1.24, démarrez-la une fois, puis revenez à celle-ci.",
      disk_space: "Il n'y a pas assez de place sur le disque du serveur. Libérez de l'espace : le prochain essai repartira.",
      other: "Le journal du serveur (lignes [db-migration]) dit pourquoi.",
    },
  },
  en: {
    title: "Database migration in progress",
    body: "Tentacle is moving to a lighter database. This can take a few minutes.",
    tables: "{done} of {total} tables",
    etaMinutes: "About {n} min left",
    etaSoon: "Less than a minute left",
    etaUnknown: "Estimating the time left…",
    footer: "This page updates by itself: Tentacle comes back as soon as it is done.",
    failedTitle: "The migration did not complete",
    failedBody: "Your data is intact: the old database was not modified.",
    retryIn: "Automatic retry in {time}.",
    retryNow: "Retrying now…",
    rollback: "To go back to the previous version: redeploy the previous image (for example ghcr.io/knaox/tentacle-tv:v1.24.0). It starts again on your intact database.",
    reasons: {
      source_unreachable: "The old database does not answer. Check that it is running and that Tentacle can reach it.",
      source_config: "A connection setting of the old database is not understood. The server log says which one.",
      source_too_old: "This installation is too old to move straight to this version: install version 1.24 first, start it once, then come back to this one.",
      disk_space: "There is not enough space on the server's disk. Free some space: the next attempt will start again.",
      other: "The server log ([db-migration] lines) says why.",
    },
  },
} as const;

/** La langue d'un navigateur (`Accept-Language`) : le français s'il vient en tête, l'anglais sinon. */
export function waitingLang(acceptLanguage: string | undefined): WaitingLang {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}
