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

    case "request_status": {
      if (!plugins || plugins.length === 0) return null;
      // Find the first plugin that has a user-facing nav item for this platform
      for (const plugin of plugins) {
        const nav = plugin.navItems.find((n) =>
          n.platforms.includes(platform),
        );
        if (nav) {
          return platform === "mobile"
            ? `/plugin/${plugin.pluginId}`
            : nav.path;
        }
      }
      return null;
    }

    case "watchlist_share":
      return platform === "mobile" && refId
        ? `/shared-watchlist/${refId}`
        : "/watchlist";

    default:
      return null;
  }
}
