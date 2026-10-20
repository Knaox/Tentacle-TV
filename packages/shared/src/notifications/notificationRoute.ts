import { extensionSectionHref } from "./extensionSection";

/** L'écran de la Famille, le même chemin sur le web, le bureau et le mobile. */
export const FAMILY_ROUTE = "/family";

/** Minimal plugin metadata needed for notification route resolution. */
export interface NotifPluginMeta {
  pluginId: string;
  navItems: Array<{ path: string; platforms: string[] }>;
}

/**
 * Resolve a navigation route from a notification.
 * Returns `null` when no route can be determined (unknown type, missing data).
 */
export function resolveNotificationRoute(
  notif: { type: string; refId: string | null },
  platform: "web" | "mobile",
  plugins?: NotifPluginMeta[],
): string | null {
  const { type, refId } = notif;

  switch (type) {
    case "ticket_reply":
    case "ticket_status":
      return refId ? `/support?ticketId=${refId}` : "/support";

    // Adressés aux admins : la page admin sur le web ; sur mobile, l'écran de
    // support est unique et l'admin y voit tous les tickets.
    case "ticket_new":
    case "ticket_user_reply":
    case "ticket_user_closed":
      if (platform === "mobile") return refId ? `/support?ticketId=${refId}` : "/support";
      return refId ? `/admin/tickets?ticketId=${refId}` : "/admin/tickets";

    case "request_status": {
      if (!plugins || plugins.length === 0) return null;
      // Le premier plugin qui publie une page pour cette plateforme : sa page
      // des demandes quand il en a une (un changement d'état de demande se lit
      // là), sinon sa première page. Sur mobile, la page est une section de
      // l'onglet unique des extensions.
      for (const plugin of plugins) {
        const navs = plugin.navItems.filter((n) => n.platforms.includes(platform));
        const nav = navs.find((n) => n.path.endsWith("/requests")) ?? navs[0];
        if (!nav) continue;
        return platform === "mobile" ? extensionSectionHref(plugin.pluginId, nav.path) : nav.path;
      }
      return null;
    }

    // Annonce d'arrivée poussée : la fiche du contenu quand elle n'en porte
    // qu'un (le serveur met alors son ID dans refId), l'accueil sinon.
    case "library_added":
      return refId ? `/media/${refId}` : null;

    // La Famille : l'écran de la Famille de chaque client (web, bureau, mobile).
    case "family_invite":
    case "family_invite_accepted":
    case "family_invite_declined":
    case "family_member_left":
    case "family_member_removed":
    case "family_dissolved":
      return FAMILY_ROUTE;

    case "watchlist_share":
      return platform === "mobile" && refId
        ? `/shared-watchlist/${refId}`
        : "/watchlist";

    default:
      return null;
  }
}
