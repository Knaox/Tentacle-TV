import { useEffect, useId, useState, type ReactNode } from "react";
import type { WideSettingId } from "@tentacle-tv/shared";
import { ScopeBadge } from "../ScopeBadge";
import { useGroupScope } from "./WideGroup";
import { settingAnchor, useSettingTargeted, useWideSettingMeta, useWideSettingVisible } from "./wideSettingsMeta";

/** Le temps pendant lequel une ligne visée par un lien reste soulignée. */
const TARGET_HIGHLIGHT_MS = 1800;

interface SettingItemProps {
  setting: WideSettingId;
  /** Un libellé précisé là où deux lignes se ressembleraient (« Liquid Glass dans Tentacle » à côté d'Octave). */
  label?: string;
  /** Le contrôle à droite (interrupteur, choix court) ; il passe sous le texte quand la place manque. */
  trailing?: ReactNode;
  /** Le contrôle sous l'explication, quand il demande de la place (choix, liste, formulaire). */
  children?: ReactNode;
  /** Une phrase de plus sous l'explication (un état : « active en ce moment », « non disponible ici »). */
  note?: ReactNode;
  /** Teinte destructive du libellé (zone sensible). */
  destructive?: boolean;
}

/**
 * UNE ligne de réglage du web large, toujours dessinée de la même façon :
 * son libellé, la phrase qui dit ce qu'elle fait, puis son contrôle. Libellé,
 * phrase et portée viennent du catalogue partagé (`WIDE_SETTINGS_SECTIONS`) :
 * la recherche, le rail et la ligne disent exactement la même chose. La
 * pastille de portée (« Compte », « Cet appareil », « Octave seulement ») est
 * sur le titre du GROUPE quand toutes ses lignes ont la même ; sinon, ou hors
 * d'un groupe, chaque ligne porte la sienne. Une ligne dont les conditions ne
 * tiennent pas ne se dessine pas. Visée par l'adresse (`#<id>`), elle se
 * souligne un instant.
 */
export function SettingItem({ setting, label: labelOverride, trailing, children, note, destructive }: SettingItemProps) {
  const meta = useWideSettingMeta(setting);
  const { description, scope } = meta;
  const label = labelOverride ?? meta.label;
  const visible = useWideSettingVisible(setting);
  const targeted = useSettingTargeted(setting);
  const groupScope = useGroupScope();
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
      className={`scroll-mt-24 border-line-subtle px-5 py-4 transition-colors duration-700 [&:not(:first-child)]:border-t ${highlight ? "bg-fill-soft" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5">
        {/* min-w-0 et une base : une phrase longue se replie, le contrôle passe dessous plutôt que de sortir. */}
        <div className="min-w-0 flex-[999_1_16rem]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p id={labelId} className={`text-[15px] font-semibold leading-snug ${destructive ? "text-status-error" : "text-content-primary"}`}>{label}</p>
            {scope && scope !== groupScope ? <ScopeBadge scope={scope} /> : null}
          </div>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-content-secondary">{description}</p>
          {note ? <div className="mt-1 max-w-[62ch] text-xs leading-relaxed text-content-tertiary">{note}</div> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-3.5">{children}</div> : null}
    </div>
  );
}
