import { useTranslation } from "react-i18next";
import { Bookmark, Heart, MonitorSmartphone, Pin, type LucideIcon } from "lucide-react";
import { Place } from "..";

/**
 * « Plus », en faux : « Mes listes », chaque entrée avec son épingle, puis le
 * jumelage d'une TV, sur le fond opaque de l'app (`--nav-panel-bg`). Les
 * tuiles de bibliothèques n'y sont pas : elles montreraient des bibliothèques
 * et des nombres de titres que la scène ne connaît pas.
 */

export const PANEL = { x: 60, y: 68, w: 232 } as const;
/** L'épingle de « Ma liste », en px du canevas — la cible du curseur. */
export const MY_LIST_PIN = { x: PANEL.x + PANEL.w - 27, y: PANEL.y + 46 } as const;

function Row({ icon: Icon, label, pin }: { icon: LucideIcon; label: string; pin?: "on" | "off" }) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-lg px-2 text-[11.5px] text-content-secondary">
      <Icon className="h-3.5 w-3.5 shrink-0 text-content-tertiary" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {pin && (
        <Pin
          strokeWidth={2}
          fill={pin === "on" ? "currentColor" : "none"}
          className={`h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${pin === "on" ? "text-[var(--brand-light)]" : "text-content-quaternary"}`}
        />
      )}
    </div>
  );
}

export function FauxNavPanel({ open, pinned }: { open: boolean; pinned: boolean }) {
  const { t } = useTranslation("nav");
  return (
    <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} visible={open} dy={open ? 0 : -6}>
      <div className="rounded-2xl border border-line-subtle p-3" style={{ background: "var(--nav-panel-bg)", boxShadow: "var(--shadow-dropdown)" }}>
        <p className="mb-1.5 px-1 text-[9.5px] font-semibold uppercase leading-[14px] tracking-[0.1em] text-content-quaternary">{t("lists")}</p>
        <Row icon={Bookmark} label={t("myList")} pin={pinned ? "on" : "off"} />
        <Row icon={Heart} label={t("myFavorites")} pin="off" />
        <div className="mt-2 border-t border-line-subtle pt-2">
          <Row icon={MonitorSmartphone} label={t("pairDevice")} />
        </div>
      </div>
    </Place>
  );
}
