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
          /*
            Etat actif : pilule pleine et discrete. Remplace le soulignement en
            degrade de marque surmonte d'un halo — la signature la plus datee de
            la barre, et la seule qui imposait un `style` inline sur un lien.
            Le focus clavier n'etait visible NULLE PART ici auparavant.
          */
          <Link
            key={link.key}
            to={link.path}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              active
                ? "bg-fill-soft font-semibold text-content-primary"
                : "font-medium text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
