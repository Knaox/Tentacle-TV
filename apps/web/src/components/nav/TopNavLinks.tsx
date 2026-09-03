import { useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useLibraries, useUserId } from "@tentacle-tv/api-client";
import { readRecoFilterMirror } from "../../lib/recoFilterStorage";
import { onRecoNavIntent } from "../../lib/recoPrefetch";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { resolvePluginLabel } from "../lucideIcon";
import { usePinnedNav, pluginNavKey } from "../../hooks/usePinnedNav";
import { springSoft } from "../../theme/motion";
import { NavOverflowScroller } from "./NavOverflowScroller";

interface NavLink {
  key: string;
  label: string;
  path: string;
}

export function TopNavLinks() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation("nav");
  const reduced = useReducedMotion();
  const { data: libraries } = useLibraries();
  const activePluginsMeta = useActivePluginsMeta();
  const pinned = usePinnedNav();
  const qc = useQueryClient();
  const userId = useUserId();
  // Intention de navigation : le chunk et la page se chargent au survol.
  const recoIntent = useCallback(() => onRecoNavIntent(qc, readRecoFilterMirror(userId)), [qc, userId]);

  const links: NavLink[] = useMemo(() => {
    const out: NavLink[] = [{ key: "home", label: t("home"), path: "/" }];
    out.push({ key: "recommendations", label: t("recommendations"), path: "/recommendations" });

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
        // Épinglées par défaut, retirables depuis le menu « Bibliothèques ».
        if (!pinned.isPluginNavPinned(pluginNavKey(plugin.pluginId, nav.path))) continue;
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
    <NavOverflowScroller ariaLabel="Primary">
      {links.map((link) => {
        const active = isActive(link);
        return (
          /*
            Etat actif : pilule pleine et discrete, qui GLISSE d'un lien a
            l'autre (`layoutId` partage, ressort doux — pattern segmented
            control iOS). Le fond actif vit dans le span anime, pas sur le
            lien, pour que seul le deplacement soit anime.
          */
          <Link
            key={link.key}
            to={link.path}
            aria-current={active ? "page" : undefined}
            onMouseEnter={link.key === "recommendations" ? recoIntent : undefined}
            onFocus={link.key === "recommendations" ? recoIntent : undefined}
            className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              active
                ? "font-semibold text-content-primary"
                : "font-medium text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
            }`}
          >
            {active && (
              <motion.span
                layoutId="topnav-active-pill"
                className="absolute inset-0 rounded-lg bg-fill-soft"
                transition={reduced ? { duration: 0 } : springSoft}
                aria-hidden
              />
            )}
            <span className="relative z-10">{link.label}</span>
          </Link>
        );
      })}
    </NavOverflowScroller>
  );
}
