import { useTranslation } from "react-i18next";
import { Download, Info, ShieldCheck } from "lucide-react";
import { StatusPill } from "../../../components/admin/kit";
import { PluginIcon } from "../../../components/admin-plugins/PluginIcon";
import { Place, type Placed } from "..";

/**
 * Une entrée du marketplace, en faux : celle de Vigie, telle que le registre
 * officiel la publie (nom, auteur, version, catégorie, mots-clés). Même
 * anatomie que `MarketplaceCard` ; le geste change d'état comme le vrai —
 * « Installer », « Installation… », puis la pastille « Installé ».
 */

export const VIGIE = {
  name: "Vigie — Jellyseerr (unofficial)",
  author: "Knaox",
  version: "1.17.0",
  tags: ["media", "requests", "seerr"],
  moreTags: 3,
} as const;

export type InstallPhase = "idle" | "installing" | "installed";

const PILL = "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[10.5px] font-semibold";

export function FauxMarketplaceCard({ phase, ...place }: Placed & { phase: InstallPhase }) {
  const { t } = useTranslation("adminPlugins");
  return (
    <Place {...place}>
      <div className="flex h-full flex-col rounded-2xl border border-line-subtle bg-fill-faint p-4">
        <div className="flex items-start gap-3">
          <PluginIcon name={VIGIE.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-content-primary">{VIGIE.name}</p>
            <p className="mt-0.5 truncate text-[10px] text-content-tertiary">
              {t("byAuthor", { author: VIGIE.author })} · <span className="tabular-nums">v{VIGIE.version}</span>
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <StatusPill tone="brand" size="sm" dot={false} className="!h-5 !text-[9.5px]">
            <ShieldCheck aria-hidden size={11} />
            {t("official")}
          </StatusPill>
          <StatusPill tone="neutral" size="sm" dot={false} className="!h-5 !text-[9.5px]">{t("categories.media-management")}</StatusPill>
        </div>
        <p className="mt-2.5 line-clamp-3 flex-1 text-[10.5px] leading-relaxed text-content-tertiary">{t("whatsNew:sceneVigieDescription")}</p>
        <p className="mt-1.5 truncate text-[9.5px] text-content-quaternary">
          {VIGIE.tags.map((tag) => `#${tag}`).join("  ")}  +{VIGIE.moreTags}
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-line-subtle pt-3">
          {phase === "installed" ? (
            <StatusPill tone="success" size="sm">{t("installedVersion", { version: VIGIE.version })}</StatusPill>
          ) : (
            <span className={`${PILL} border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg ${phase === "installing" ? "opacity-70" : ""}`}>
              <Download aria-hidden className="h-3.5 w-3.5" />
              {phase === "installing" ? t("installing") : t("install")}
            </span>
          )}
          <span className={`${PILL} ml-auto border-line-subtle bg-fill-soft text-content-primary`}>
            <Info aria-hidden className="h-3.5 w-3.5" />
            {t("details")}
          </span>
        </div>
      </div>
    </Place>
  );
}
