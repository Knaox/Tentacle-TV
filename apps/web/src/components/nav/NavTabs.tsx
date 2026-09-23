/**
 * Les onglets de la barre, et « Plus ».
 *
 * Autant d'onglets que la largeur en permet (`usePriorityOverflow`) ; les
 * suivants passent dans « Plus ». Quand la page courante est l'un d'eux,
 * « Plus » prend son nom, son icône et l'indicateur actif : on sait toujours
 * où l'on est, même quand l'onglet n'a pas de place.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useUserId } from "@tentacle-tv/api-client";
import { readRecoFilterMirror } from "../../lib/recoFilterStorage";
import { onRecoNavIntent } from "../../lib/recoPrefetch";
import { ActiveIndicator, NavTab, NavTabBody, TAB_CLASS, TabIcon, tabTone } from "./NavTab";
import { NavMorePanel } from "./NavMorePanel";
import { usePriorityOverflow } from "./usePriorityOverflow";
import { isActivePath, useNavDestinations } from "./useNavDestinations";

const CHEVRON = <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />;

export function NavTabs() {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const reduced = useReducedMotion() ?? false;
  const { primary, libraries, lists, extensions } = useNavDestinations();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();
  const userId = useUserId();
  // Intention d'aller aux recommandations : leur page se charge au survol.
  const recoIntent = useCallback(() => onRecoNavIntent(qc, readRecoFilterMirror(userId)), [qc, userId]);

  const signature = primary.map((d) => `${d.key}:${d.label}`).join("|");
  const { containerRef, measureRef, visible } = usePriorityOverflow(primary.length, signature);
  const shown = primary.slice(0, visible);
  const overflowActive = primary.slice(visible).find((d) => isActivePath(d.path, pathname)) ?? null;
  const moreLabel = overflowActive?.label ?? t("more");
  const MoreIcon = overflowActive?.icon ?? LayoutGrid;

  useEffect(() => setOpen(false), [pathname]);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <nav ref={containerRef} aria-label={t("railLabel")} className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {shown.map((d) => (
          <NavTab
            key={d.key}
            label={d.label}
            path={d.path}
            icon={d.icon}
            active={isActivePath(d.path, pathname)}
            reduced={reduced}
            onIntent={d.key === "recommendations" ? recoIntent : undefined}
          />
        ))}
        <button
          ref={moreRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${TAB_CLASS} ${tabTone(overflowActive !== null)} ${open ? "bg-fill-soft text-content-primary" : ""}`}
        >
          {overflowActive !== null && <ActiveIndicator reduced={reduced} />}
          <TabIcon icon={MoreIcon} active={overflowActive !== null} />
          <span className="relative max-w-[160px] truncate whitespace-nowrap">{moreLabel}</span>
          <ChevronDown aria-hidden className={`relative h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </nav>

      {/* La rangée fantôme : tous les onglets et « Plus », mis en page mais
          invisibles et hors du flux — la mesure de `usePriorityOverflow`. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-1">
        {primary.map((d) => <NavTabBody key={d.key} label={d.label} icon={d.icon} />)}
        <NavTabBody label={moreLabel} icon={MoreIcon} trailing={CHEVRON} />
      </div>

      {open && (
        <NavMorePanel libraries={libraries} lists={lists} extensions={extensions} trigger={moreRef} onClose={close} />
      )}
    </div>
  );
}
