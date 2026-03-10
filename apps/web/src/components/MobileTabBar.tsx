import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { useLibraries } from "@tentacle-tv/api-client";
import { getLucideIcon, resolvePluginLabel } from "./lucideIcon";
import { PlusMenu } from "./PlusMenu";
import { usePinnedNav } from "../hooks/usePinnedNav";

interface Tab {
  path: string;
  label: string;
  icon: React.ReactNode;
  match?: (p: string) => boolean;
  isPlus?: boolean;
}

export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("nav");
  const activePluginsMeta = useActivePluginsMeta();
  const pinned = usePinnedNav();
  const { data: libraries } = useLibraries();
  const [plusOpen, setPlusOpen] = useState(false);

  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [
      {
        path: "/", label: t("home"),
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>,
        match: (p) => p === "/",
      },
    ];

    // Pinned watchlist
    if (pinned.watchlist) {
      list.push({
        path: "/watchlist", label: t("myList"),
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>,
      });
    }

    // Pinned favorites
    if (pinned.favorites) {
      list.push({
        path: "/favorites", label: t("myFavorites"),
        icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>,
      });
    }

    // Pinned libraries
    if (libraries) {
      for (const lib of libraries) {
        if (pinned.isLibraryPinned(lib.Id)) {
          list.push({
            path: `/library/${lib.Id}`,
            label: lib.Name,
            icon: lib.CollectionType === "movies"
              ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
              : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" /></svg>,
            match: (p: string) => p.startsWith(`/library/${lib.Id}`),
          });
        }
      }
    }

    // Plugin nav items
    for (const plugin of activePluginsMeta) {
      if (plugin.configEnabled !== true) continue;
      for (const nav of plugin.navItems || []) {
        if (nav.admin || !nav.platforms?.includes("web")) continue;
        list.push({
          path: nav.path,
          label: resolvePluginLabel(nav.labels ?? nav.label, i18n.language),
          icon: getLucideIcon(nav.icon),
          match: (p: string) => p.startsWith(nav.path),
        });
      }
    }

    // Plus button (always present)
    list.push({
      path: "__plus__", label: t("more"),
      icon: <PlusTabIcon />,
      isPlus: true,
    });

    // Profile at the end
    list.push({
      path: "/settings", label: t("profile"),
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
    });

    return list;
  }, [t, i18n.language, activePluginsMeta, pinned, libraries]);

  const isActive = (tab: Tab) => {
    if (tab.isPlus) return plusOpen;
    if (tab.match) return tab.match(location.pathname);
    return location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-white/10 bg-black/95 backdrop-blur-xl safe-area-pb">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.path}
              onClick={() => {
                if (tab.isPlus) {
                  setPlusOpen(!plusOpen);
                } else {
                  navigate(tab.path);
                }
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-purple-400" : "text-white/40"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {plusOpen && (
        <PlusMenu
          onClose={() => setPlusOpen(false)}
          isMobile={true}
        />
      )}
    </>
  );
}

function PlusTabIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}
