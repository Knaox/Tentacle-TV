import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useWatchProviders } from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES } from "@tentacle-tv/shared";
import { useRecoFilter } from "../../hooks/useRecoFilter";
import { PlatformLogo } from "../reco/PlatformLogo";
import { buildPlatformCatalog, isFamilyActive } from "../reco/platformCatalog";

const LOGOS_MAX = 3;

/**
 * La puce du filtre de plateformes sur l'accueil, à côté du titre de la
 * première rangée reco servie : les logos et les noms des familles actives,
 * et une croix qui retire le filtre — du COMPTE, donc aussi de la page
 * Recommandations (même store, PUT débouncé par RecoFilterBinding). Rien
 * sans filtre. Fond opaque, aucun backdrop-filter (règle GPU).
 */
export function HomeRecoFilterChip() {
  const { t } = useTranslation("reco");
  const { selected, clear } = useRecoFilter();
  const { data: directory } = useWatchProviders();
  const active = useMemo(
    () => buildPlatformCatalog(PLATFORM_FAMILIES, directory).filter((entry) => isFamilyActive(entry, selected)),
    [directory, selected]
  );
  if (selected.length === 0) return null;

  // Un filtre dont aucune famille ne se résout (région sans ces plateformes) :
  // un libellé générique — la croix, elle, reste là.
  const label = active.length > 0 ? active.map((entry) => entry.label).join(", ") : t("homeFilterGeneric");

  return (
    <span className="ml-1 flex min-w-0 items-center gap-1.5 rounded-full border border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] py-0.5 pl-1.5 pr-1 text-xs font-medium text-[var(--brand)]">
      {active.slice(0, LOGOS_MAX).map((entry) => (
        <PlatformLogo key={entry.key} logoPath={entry.logoPath} label={entry.label} className="h-4 w-4" />
      ))}
      <span className="max-w-[40vw] truncate md:max-w-xs">{label}</span>
      <button
        type="button"
        onClick={clear}
        aria-label={t("homeFilterRemove")}
        title={t("homeFilterRemove")}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--brand-rgb),0.2)]"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}
