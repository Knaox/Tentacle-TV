import { useEffect, useId, useState, type ReactNode } from "react";
import type { WideSettingId } from "@tentacle-tv/shared";
import { ScopeBadge } from "../ScopeBadge";
import { settingAnchor, useSettingTargeted, useWideSettingMeta, useWideSettingVisible } from "./wideSettingsMeta";

/** Le temps pendant lequel une ligne visée par un lien reste soulignée. */
const TARGET_HIGHLIGHT_MS = 1800;

interface SettingItemProps {
  setting: WideSettingId;
  /** Un libellé précisé là où deux lignes se ressembleraient (« Liquid Glass dans Tentacle » à côté d'Octave). */
  label?: string;
  /** Le contrôle à droite (interrupteur, choix court). */
  trailing?: ReactNode;
  /** Le contrôle sous l'explication, quand il demande de la place (choix, liste, formulaire). */
  children?: ReactNode;
  /** Une phrase de plus sous l'explication (un état : « active en ce moment », « non disponible ici »). */
  note?: ReactNode;
  /** Retire le filet du bas — la dernière ligne d'une carte. */
  last?: boolean;
  /** Teinte destructive du libellé (zone sensible). */
  destructive?: boolean;
}

/**
 * UNE ligne de réglage du web large, toujours dessinée de la même façon :
 * son libellé et sa pastille de portée (« Compte », « Cet appareil »,
 * « Octave seulement »), la phrase qui dit ce qu'elle fait, puis son contrôle.
 * Libellé, phrase et portée viennent du catalogue partagé
 * (`WIDE_SETTINGS_SECTIONS`) : la recherche, le rail et la ligne disent
 * exactement la même chose. Une ligne dont les conditions ne tiennent pas ne
 * se dessine pas. Visée par l'adresse (`#<id>`), elle se souligne un instant.
 */
export function SettingItem({ setting, label: labelOverride, trailing, children, note, last, destructive }: SettingItemProps) {
  const meta = useWideSettingMeta(setting);
  const { description, scope } = meta;
  const label = labelOverride ?? meta.label;
  const visible = useWideSettingVisible(setting);
  const targeted = useSettingTargeted(setting);
  const [highlight, setHighlight] = useState(false);
  const labelId = useId();

  useEffect(() => {
    if (!targeted) return;
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), TARGET_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [targeted]);

  if (!visible) return null;
  return (
    <div
      {...settingAnchor(setting)}
      role="group"
      aria-labelledby={labelId}
      className={`scroll-mt-24 px-4 py-3.5 transition-colors duration-700 ${last ? "" : "border-b border-line-subtle"} ${highlight ? "bg-fill-soft" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* min-w-0 : sans lui, une phrase longue pousse le contrôle hors de la carte. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p id={labelId} className={`text-sm font-medium ${destructive ? "text-status-error" : "text-content-primary"}`}>{label}</p>
            {scope ? <ScopeBadge scope={scope} /> : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{description}</p>
          {note ? <div className="mt-1 text-xs leading-relaxed text-content-quaternary">{note}</div> : null}
        </div>
        {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
