import type { WhatsNewRelease } from "../types";
import { AdminMessageScene, LiveSessionsScene, RemoteControlScene, ServerStopScene } from "../scenes/v1_22_0";

/**
 * 1.22.0 — la lecture suivie par le serveur. Trois nouveautés pour tous :
 * fermer l'application arrête vraiment la lecture chez Jellyfin, les messages
 * de l'administrateur s'affichent, et le tableau de bord a la télécommande —
 * plus « Sessions en direct », montrée aux seuls administrateurs
 * (`audience`) et sans lien profond : jamais une route admin (cf.
 * docs/NOUVEAUTES.md). Moins de requêtes vers Jellyfin, c'est vrai mais ça
 * ne se montre pas : c'est le changelog qui le raconte.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_22_0_<id>_title / _body).
 */
export const RELEASE_1_22_0: WhatsNewRelease = {
  version: "1.22.0",
  features: [
    { id: "serverStop", kind: "fixed", titleKey: "v1_22_0_serverStop_title", bodyKey: "v1_22_0_serverStop_body", Scene: ServerStopScene },
    { id: "adminMessage", kind: "new", titleKey: "v1_22_0_adminMessage_title", bodyKey: "v1_22_0_adminMessage_body", Scene: AdminMessageScene },
    { id: "remote", kind: "new", titleKey: "v1_22_0_remote_title", bodyKey: "v1_22_0_remote_body", Scene: RemoteControlScene },
    {
      id: "liveSessions",
      kind: "new",
      titleKey: "v1_22_0_liveSessions_title",
      bodyKey: "v1_22_0_liveSessions_body",
      Scene: LiveSessionsScene,
      audience: "admin",
    },
  ],
};
