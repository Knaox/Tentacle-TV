import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { resolvePluginLabel } from "../lucideIcon";
import { usePinnedNav } from "../../hooks/usePinnedNav";

interface NavLink {
  key: string;
  label: string;
  path: string;
}

export function TopNavLinks() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const activePluginsMeta = useActivePluginsMeta();
  const pinned = usePinnedNav();

  const links: NavLink[] = useMemo(() => {
    const out: NavLink[] = [{ key: "home", label: t("home"), path: "/" }];

    if (pinned.watchlist) {
      out.push({ key: "watchlist", label: t("myList"), path: "/watchlist" });
    }
    if (pinned.favorites) {
      out.push({ key: "favorites", label: t("myFavorites"), path: "/favorites" });
    }

    if (libraries) {
      for (const lib of libraries) {
        if (pinned.isLibraryPinned(lib.Id)) {
          out.push({ key: `lib-${lib.Id}`, label: lib.Name, path: `/library/${lib.Id}` });
        }
      }
    }

    for (const plugin of activePluginsMeta) {
      if (plugin.configEnabled !== true) continue;
      for (const nav of plugin.navItems || []) {
        if (nav.admin || !nav.platforms?.includes("web")) continue;
        out.push({
          key: `plugin-${plugin.pluginId}-${nav.path}`,
          label: resolvePluginLabel(nav.labels ?? nav.label, i18n.language),
          path: nav.path,
        });
      }
    }

    return out;
  }, [t, i18n.language, libraries, activePluginsMeta, pinned]);

  const isActive = (link: NavLink) => {
    if (link.key === "home") return pathname === "/";
    return pathname === link.path || pathname.startsWith(link.path + "/");
  };

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide" aria-label="Primary">
      {links.map((link) => {
        const active = isActive(link);
        return (
          <Link
            key={link.key}
            to={link.path}
            className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
              active
                ? "text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            {link.label}
            {active && (
              <span
                className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full"
                style={{
                  background: "linear-gradient(90deg, #8B5CF6, #A78BFA)",
                  boxShadow: "0 0 10px rgba(139,92,246,0.6)",
                }}
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
