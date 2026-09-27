import { motion } from "framer-motion";
import { Fragment } from "react";
import { useAdminSections } from "../../../components/admin/adminSections";
import { Place, sceneTween } from "..";

/**
 * Le rail de l'administration, en faux : les VRAIES sections
 * (`useAdminSections` — libellés, icônes, groupes), la pilule pleine de la
 * section active, et le calque de survol révélé en opacité. Même anatomie que
 * `SettingsShell`, en plus petit.
 */

export const RAIL = { x: 16, y: 18, w: 150 } as const;
/** Hauteur d'une ligne, d'un intertitre et de l'écart entre groupes. */
const ROW = 24;
const HEADING = 18;
const GAP = 8;

interface FauxAdminRailProps {
  activeId: string;
  hoveredId?: string;
}

/** Le milieu de la ligne `id`, en px du canevas — la cible du curseur. */
export function railRowCenter(sections: ReadonlyArray<{ id: string; group?: string }>, id: string) {
  let y = RAIL.y;
  let group: string | undefined;
  for (const [index, section] of sections.entries()) {
    if (section.group !== group) {
      group = section.group;
      if (index > 0) y += GAP;
      if (group) y += HEADING;
    }
    if (section.id === id) return { x: RAIL.x + 70, y: y + ROW / 2 };
    y += ROW;
  }
  return { x: RAIL.x + 70, y: RAIL.y };
}

export function FauxAdminRail({ activeId, hoveredId }: FauxAdminRailProps) {
  const sections = useAdminSections();
  return (
    <Place x={RAIL.x} y={RAIL.y} w={RAIL.w}>
      {sections.map((section, index) => {
        const opensGroup = section.group !== sections[index - 1]?.group;
        const active = section.id === activeId;
        return (
          <Fragment key={section.id}>
            {opensGroup && index > 0 && <div style={{ height: GAP }} />}
            {opensGroup && section.group && (
              <p
                className="px-2 text-[9px] font-semibold uppercase tracking-wider text-content-tertiary"
                style={{ height: HEADING, lineHeight: `${HEADING - 4}px` }}
              >
                {section.group}
              </p>
            )}
            <div
              className={`relative flex items-center gap-2 overflow-hidden rounded-md px-2 text-[11px] ${
                active ? "bg-fill-soft font-medium text-content-primary" : "text-content-secondary"
              }`}
              style={{ height: ROW }}
            >
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-fill-subtle"
                initial={false}
                animate={{ opacity: !active && section.id === hoveredId ? 1 : 0 }}
                transition={sceneTween}
              />
              <span
                className={`relative flex w-3.5 shrink-0 justify-center [&>svg]:h-3.5 [&>svg]:w-3.5 ${
                  active ? "text-content-primary" : "text-content-tertiary"
                }`}
              >
                {section.icon}
              </span>
              <span className="relative truncate">{section.label}</span>
            </div>
          </Fragment>
        );
      })}
    </Place>
  );
}
