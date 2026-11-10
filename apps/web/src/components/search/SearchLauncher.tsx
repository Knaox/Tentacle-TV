/**
 * Ce qui OUVRE la recherche depuis une barre : un faux champ sur desktop — on
 * le lit comme une barre de recherche, on clique dedans, l'omnibox s'ouvre à
 * sa place —, une icône sur mobile. Le rappel du raccourci est celui du
 * clavier de l'utilisateur (⌘K ou Ctrl+K).
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { searchShortcutLabel } from "../../lib/shortcutLabel";
import { NavGroup } from "../nav/NavGroup";
import { openOmnibox } from "./omniboxStore";

export const SearchLauncher = memo(function SearchLauncher({ variant, className = "" }: {
  variant: "field" | "icon";
  className?: string;
}) {
  const { t } = useTranslation("search");
  if (variant === "icon") {
    return (
      <button type="button" onClick={() => openOmnibox()} aria-label={t("open")} title={t("open")} className={`icon-btn ${className}`}>
        <MagnifyingGlassIcon size={20} aria-hidden />
      </button>
    );
  }
  // Le champ EST un groupe de la barre (refonte de nov. 2026) : son verre est celui du groupe,
  // le bouton n'en porte aucun — jamais de verre sur du verre. `lgc-field` : repère du verre natif.
  return (
    <NavGroup className={className} contentClassName="">
      <button
        type="button"
        onClick={() => openOmnibox()}
        aria-label={t("open")}
        className="lgc-field flex h-full w-full items-center gap-2.5 rounded-pill pl-3.5 pr-2 text-left text-sm text-content-secondary outline-none transition-colors duration-hover hover:text-content-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
      >
        <MagnifyingGlassIcon size={16} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{t("launcher")}</span>
        <kbd className="ui-kbd hidden shrink-0 font-sans xl:inline">{searchShortcutLabel()}</kbd>
      </button>
    </NavGroup>
  );
});
