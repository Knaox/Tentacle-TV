import { lazy } from "react";
import type { TentaclePlugin } from "@tentacle-tv/plugins-api";
import { isSeerConfigured } from "./api/seer-client";

const DiscoverPage = lazy(() =>
  import("./components/DiscoverPage").then((m) => ({ default: m.DiscoverPage }))
);
const RequestsPage = lazy(() =>
  import("./components/RequestsPage").then((m) => ({ default: m.RequestsPage }))
);
const SeerConfigPage = lazy(() =>
  import("./components/admin/SeerConfigPage").then((m) => ({ default: m.SeerConfigPage }))
);

/* ---- Icons ---- */

function DiscoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function RequestsIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function ConfigIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/* ---- Plugin definition ---- */

export const seerPlugin: TentaclePlugin = {
  id: "seer",
  name: "Seer - Demandes de medias",
  version: "1.0.0",
  description: "Demandez des films et series via Jellyseerr. Decouvrez du contenu, demandez en 1 clic, suivez vos demandes.",

  routes: [
    {
      path: "/discover",
      component: DiscoverPage,
      label: "Decouvrir",
      icon: DiscoverIcon,
      showInMobileNav: true,
      showInSidebar: true,
      requiresAuth: true,
    },
    {
      path: "/requests",
      component: RequestsPage,
      label: "Mes demandes",
      icon: RequestsIcon,
      showInMobileNav: true,
      showInSidebar: true,
      requiresAuth: true,
    },
  ],

  navItems: [
    {
      label: "Decouvrir",
      path: "/discover",
      icon: DiscoverIcon,
      platforms: ["web", "desktop", "mobile"],
    },
    {
      label: "Demandes",
      path: "/requests",
      icon: RequestsIcon,
      platforms: ["web", "desktop", "mobile"],
    },
  ],

  adminRoutes: [
    {
      path: "/admin/plugins/seer",
      component: SeerConfigPage,
      label: "Configuration Seer",
      icon: ConfigIcon,
      showInMobileNav: false,
      showInSidebar: false,
      requiresAuth: true,
      requiresAdmin: true,
    },
  ],

  adminNavItems: [
    {
      label: "Seer",
      path: "/admin/plugins/seer",
      icon: ConfigIcon,
      platforms: ["web", "desktop"],
    },
  ],

  isConfigured: isSeerConfigured,

  async initialize() {
    // Plugin init — could be used for preloading config, etc.
  },

  async destroy() {
    // Cleanup
  },
};
