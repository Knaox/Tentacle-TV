/**
 * Navigation principale du MODE HORS LIGNE.
 *
 * # Pourquoi elle existe
 *
 * Hors ligne, les onglets de la barre (`NavTabs`) ne s'affichent pas : ce sont
 * des bibliothèques du serveur, injoignables. La barre se retrouvait donc vide,
 * et depuis « Gérer les téléchargements » il n'y avait plus aucun chemin
 * visible vers le catalogue — seul le logo y menait, ce que rien n'indique.
 *
 * Deux entrées, qui sont exactement les deux pages atteignables :
 *
 *  - `/`          le catalogue de ce qui est sur la machine ;
 *  - `/downloads` la gestion des transferts et de l'espace.
 *
 * Les MÊMES onglets que la navigation en ligne, indicateur glissant compris :
 * hors ligne n'est pas un mode dégradé, c'est le même produit avec moins de
 * contenu.
 */

import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Download, HardDrive } from "lucide-react";
import { NavTab } from "../components/nav/NavTab";

export function OfflineNavLinks() {
  const { t } = useTranslation(["nav", "downloads"]);
  const { pathname } = useLocation();
  const reduced = useReducedMotion() ?? false;
  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label={t("nav:railLabel")}>
      {/* `/` en égalité stricte : en préfixe il capterait tout. */}
      <NavTab label={t("nav:downloads")} path="/" icon={HardDrive} active={pathname === "/"} reduced={reduced} />
      <NavTab label={t("downloads:offlineManage")} path="/downloads" icon={Download} active={pathname.startsWith("/downloads")} reduced={reduced} />
    </nav>
  );
}
