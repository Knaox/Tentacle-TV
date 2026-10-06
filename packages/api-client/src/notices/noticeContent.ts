import type { ClientNotice } from "./useClientNotice";

/**
 * Ce que dit chaque avertissement surgissant, et où mène son geste — une
 * source pour le web, le bureau, le mobile et l'iPad (clés de l'espace
 * `notices`). Le chemin est une page du client web : le web y navigue, le
 * mobile l'ouvre dans le navigateur, sur l'adresse du serveur.
 */
export interface NoticeContent {
  icon: "server" | "key";
  titleKey: string;
  /** Les phrases, dans l'ordre. */
  textKeys: string[];
  /** Le geste qui règle le problème. */
  actionKey: string;
  actionPath: string;
  /** « Ne plus afficher… » et ce qu'on dit une fois masqué ; absent : jamais masquable. */
  dismissKey?: string;
  dismissedKey?: string;
}

const ADMIN_KEY_CAUSES: Record<string, string> = {
  revoquee: "notices:adminKeyRevoked",
  sansDroits: "notices:adminKeyNoRights",
  absente: "notices:adminKeyMissing",
};

export function noticeContent(notice: ClientNotice): NoticeContent {
  switch (notice.id) {
    case "serverUpdate":
      return {
        icon: "server",
        titleKey: "notices:serverUpdateTitle",
        textKeys: ["notices:serverUpdateText"],
        actionKey: "notices:serverUpdateHow",
        actionPath: "/admin",
      };
    case "serverNews":
      return {
        icon: "server",
        titleKey: "notices:serverNewsTitle",
        textKeys: ["notices:serverNewsText"],
        actionKey: "notices:serverUpdateHow",
        actionPath: "/admin",
        dismissKey: "notices:serverNewsDismiss",
        dismissedKey: "notices:serverNewsDismissed",
      };
    case "tmdbKey":
      return {
        icon: "key",
        titleKey: "notices:tmdbKeyTitle",
        textKeys: ["notices:tmdbKeyText"],
        actionKey: "notices:tmdbKeyAdd",
        actionPath: "/admin/metadata",
        dismissKey: "notices:dismissForGood",
        dismissedKey: "notices:tmdbKeyDismissed",
      };
    case "adminKey":
      return {
        icon: "key",
        titleKey: "notices:adminKeyTitle",
        textKeys: [ADMIN_KEY_CAUSES[notice.adminKeyState ?? ""] ?? "notices:adminKeyMissing", "notices:adminKeyImpact"],
        actionKey: "notices:adminKeyFix",
        actionPath: "/admin/services#jellyfin",
      };
  }
}
