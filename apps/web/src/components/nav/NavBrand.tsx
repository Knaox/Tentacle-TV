/**
 * La marque, au bout gauche de la barre : le logo, et le nom quand la place
 * le permet. Elle ramène à l'accueil — et compte les clics pour le jeu caché
 * du logo, sans jamais empêcher la navigation.
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../ui/TentacleLogo";
import { countLogoClick } from "../easterEggs/logoEggStore";

export const NavBrand = memo(function NavBrand() {
  const { t } = useTranslation("nav");
  return (
    <Link
      to="/"
      onClick={countLogoClick}
      aria-label={t("brandHome")}
      className="flex shrink-0 items-center gap-2.5 rounded-[11px] px-2 py-1 outline-none transition-opacity duration-200 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <TentacleLogo size="md" variant="bare" />
      <span className="hidden whitespace-nowrap text-[15px] font-bold tracking-[-0.02em] text-content-primary xl:inline">
        Tentacle<span className="font-semibold text-content-tertiary"> TV</span>
      </span>
    </Link>
  );
});
