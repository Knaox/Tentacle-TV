/**
 * Labo du verre — la vue « menus » (`/dev/verre?vue=menus`), lot lg2, axe B.
 *
 * Les VRAIS menus et popovers de l'app, ouverts ensemble sur les dessous du
 * labo (`?fond=…`) : menu du compte (en-tête, familles, « Déconnexion »), menu
 * « Plus » (bibliothèques RÉELLES de la session : tuiles illustrées), liste de
 * tri à coches, menu contextuel d'une carte. On y juge UNE plaque par menu —
 * un ton, aucune bande, la pastille d'accent insérée au survol ou au focus
 * clavier (les rangées portent `data-lab-menu` pour un banc).
 *
 * Aucun geste réel : les rangées ne font rien, les épingles du menu « Plus »
 * non plus (éditeur factice). Paquets de développement seulement.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { FloatingLayer } from "../../components/floating/FloatingLayer";
import { CheckRow } from "../../components/library/LibraryFilterMenus";
import { NavMorePanel } from "../../components/nav/NavMorePanel";
import { useNavDestinations, type NavBarEditor } from "../../components/nav/useNavDestinations";
import { Dropdown } from "../../components/ui/Dropdown";
import { AccountHeader } from "../../components/userMenu/AccountHeader";
import { AdminIcon, HelpIcon, InfoIcon, LogoutIcon, OfflineIcon, OnDeviceIcon, SettingsIcon, StatsIcon, SwitchProfileIcon } from "../../components/userMenu/icons";
import type { UserMenuGroup } from "../../components/userMenu/menuItems";
import { MenuRow, UserMenuGroups } from "../../components/userMenu/UserMenuGroups";

const noop = (): void => undefined;
const EDITOR: NavBarEditor = { pin: noop, unpin: noop, reorder: noop, nudge: noop, reset: noop };

const GROUPS: UserMenuGroup[] = [
  { key: "account", items: [
    { key: "stats", label: "Mes statistiques", icon: <StatsIcon />, action: noop },
    { key: "preferences", label: "Paramètres du compte", icon: <SettingsIcon />, action: noop },
    { key: "admin", label: "Administration", icon: <AdminIcon />, action: noop },
  ] },
  { key: "device", items: [
    { key: "onDevice", label: "Sur cet appareil", icon: <OnDeviceIcon />, action: noop },
    { key: "goOffline", label: "Passer hors ligne", icon: <OfflineIcon />, action: noop },
  ] },
  { key: "support", items: [
    { key: "help", label: "Aide", icon: <HelpIcon />, action: noop },
    { key: "about", label: "À propos", icon: <InfoIcon />, action: noop },
  ] },
  { key: "session", items: [{ key: "logout", label: "Déconnexion", icon: <LogoutIcon />, action: noop, danger: true }] },
];

/** Une ancre fixe : le menu se pose dessous comme sous son bouton. */
function Anchor({ top, left, label, anchorRef }: { top: number; left: number; label: string; anchorRef?: RefObject<HTMLSpanElement | null> }) {
  return (
    <span ref={anchorRef} style={{ position: "absolute", top, left, fontSize: 11, color: "#fff", textShadow: "0 1px 2px #000" }}>
      {label}
    </span>
  );
}

function AccountScene({ top, left }: { top: number; left: number }) {
  return (
    <div style={{ position: "absolute", top, left }}>
      <span style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 2px #000" }}>Menu du compte</span>
      <Dropdown open onClose={noop} placement="bottom-start" minWidth={260}>
        <div data-lab-menu="account">
          <div className="lg-sep border-b border-line-subtle pb-1.5">
            <AccountHeader avatar="K" ringStyle={{ background: "#7c3aed" }} name="Knaoxtest" caption="Changer la photo de profil" uploading={false} onChangePhoto={noop} />
            <MenuRow item={{ key: "switch", label: "Changer de profil", icon: <SwitchProfileIcon />, action: noop }} />
          </div>
          <UserMenuGroups groups={GROUPS} />
        </div>
      </Dropdown>
    </div>
  );
}

function SortScene({ anchor }: { anchor: RefObject<HTMLSpanElement | null> }) {
  const [checked, setChecked] = useState("date");
  const rows = [["date", "Date d'ajout"], ["title", "Titre (A → Z)"], ["year", "Année"], ["rating", "Note"]] as const;
  return (
    <FloatingLayer open anchor={anchor} onDismiss={noop} side="bottom" align="start" className="lg-menu overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] bg-surface-dropdown p-3" style={{ width: 240 }}>
      <div className="flex flex-col gap-0.5" role="menu" data-lab-menu="sort">
        {rows.map(([key, label]) => <CheckRow key={key} label={label} checked={checked === key} onClick={() => setChecked(key)} />)}
        <div className="lg-sep my-1 border-t border-line-subtle" />
        <button type="button" role="menuitem" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-content-secondary">Ordre décroissant</button>
      </div>
    </FloatingLayer>
  );
}

function ContextScene({ x, y }: { x: number; y: number }) {
  const anchor = useMemo(() => ({ x, y }), [x, y]);
  return (
    <FloatingLayer open anchor={anchor} onDismiss={noop} side="bottom" align="start" role="menu" className="lg-menu lg-menu-list min-w-[240px] rounded-xl border border-line-subtle bg-surface-dropdown py-1">
      <div data-lab-menu="context">
        {["Ajouter à Ma liste", "Ajouter aux favoris", "Marquer comme vu"].map((label) => (
          <button key={label} type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-content-secondary hover:bg-fill-soft">
            {label}
          </button>
        ))}
      </div>
    </FloatingLayer>
  );
}

export function LabMenus({ top: hostTop }: { top: number }) {
  // Le bandeau de la coquille peut manquer (pont simulé d'un banc) : une base sûre.
  const top = Number.isFinite(hostTop) ? hostTop : 52;
  const nav = useNavDestinations();
  const moreAnchor = useRef<HTMLSpanElement>(null);
  const sortAnchor = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      <AccountScene top={top + 20} left={40} />
      <Anchor top={top + 20} left={360} label="Menu « Plus » (bibliothèques réelles)" anchorRef={moreAnchor} />
      <Anchor top={top + 480} left={40} label="Tri (coches)" anchorRef={sortAnchor} />
      {ready && (
        <>
          <NavMorePanel libraries={nav.libraries} lists={nav.lists} extensions={nav.extensions} editor={EDITOR} trigger={moreAnchor} onClose={noop} onCustomize={noop} />
          <SortScene anchor={sortAnchor} />
          <ContextScene x={1040} y={top + 480} />
        </>
      )}
    </div>
  );
}
