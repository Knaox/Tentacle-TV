/**
 * Navigation principale du MODE HORS LIGNE.
 *
 * # Pourquoi elle existe
 *
 * Hors ligne, `TopNavLinks` ne s'affiche pas : ses entrées sont des
 * bibliothèques du serveur, injoignables. La barre se retrouvait donc vide, et
 * depuis « Gérer les téléchargements » il n'y avait plus aucun chemin visible
 * vers le catalogue — seul le logo y menait, ce que rien n'indique.
 *
 * Deux entrées, qui sont exactement les deux pages atteignables :
 *
 *  - `/`          le catalogue de ce qui est sur la machine ;
 *  - `/downloads` la gestion des transferts et de l'espace.
 *
 * Même pilule glissante que la navigation en ligne : hors ligne n'est pas un
 * mode dégradé, c'est le même produit avec moins de contenu.
 */

import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { springSoft } from "../theme/motion";

export function OfflineNavLinks() {
  const { t } = useTranslation(["nav", "downloads"]);
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  const links = useMemo(
    () => [
      { key: "catalogue", label: t("nav:downloads"), path: "/" },
      { key: "gerer", label: t("downloads:offlineManage"), path: "/downloads" },
    ],
    [t],
  );

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide" aria-label="Primary">
      {links.map((link) => {
        // `/` doit être une égalité stricte : en préfixe il capterait tout.
        const active = link.path === "/" ? pathname === "/" : pathname.startsWith(link.path);
        return (
          <Link
            key={link.key}
            to={link.path}
            aria-current={active ? "page" : undefined}
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
    </nav>
  );
}
