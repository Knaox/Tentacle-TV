/**
 * Labo du verre — les GRANDES surfaces (régime `surface`, lot lg2) : un menu,
 * un popover en sections, une barre latérale. UN ton tenu, matériau épais,
 * rangées en PASTILLES INSÉRÉES (accent uni au survol), sélection de barre
 * latérale NEUTRE — l'idiome des menus et du Finder de macOS 26. Rien que les
 * jetons du contrat (`surfaceTokens.css`) : ce que les axes B et C reçoivent.
 *
 * `?vue=grandes` ; on les juge sur `affiches`, `blanc`, `couleurs`, `texte`,
 * `mixte`, dans les deux thèmes.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Download, Heart, LogOut, Monitor, Palette, Settings, Shield, Sparkles, Users } from "lucide-react";

import { LiquidGlass } from "../../theme/glass";

const row: CSSProperties = { display: "flex", alignItems: "center" };
const ICON = 17;

/** Une rangée de menu : la pastille insérée, l'accent uni et des glyphes blancs au survol. */
function MenuRow({ icon, label, danger = false }: { icon: ReactNode; label: string; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        ...row,
        gap: 10,
        width: "100%",
        height: 32,
        padding: "0 10px",
        border: 0,
        fontSize: 14,
        borderRadius: "var(--lg-row-radius)",
        background: hover ? "var(--lg-row-highlight)" : "none",
        color: hover ? "var(--lg-row-highlight-glyph)" : danger ? "var(--lg-danger)" : "inherit",
        textShadow: hover ? "none" : undefined,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const Separator = () => <div style={{ height: 1, margin: "5px 10px", background: "var(--lg-separator)" }} />;

const SectionLabel = ({ children }: { children: string }) => (
  <div style={{ padding: "8px 10px 4px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lg-section-label)" }}>
    {children}
  </div>
);

/** Le menu du compte (capture 1 de Damien) : une plaque, un ton. */
export function LabSurfaceMenu({ top, right }: { top: number; right: number }) {
  return (
    <LiquidGlass scale="surface" radius="md" style={{ position: "fixed", top, right, width: 260, padding: "var(--lg-row-inset)", zIndex: 30 }}>
      <div style={{ ...row, gap: 10, padding: "8px 10px" }}>
        <span style={{ ...row, justifyContent: "center", width: 36, height: 36, borderRadius: 18, fontWeight: 700, color: "#fff", background: "var(--cta-brand-gradient)" }}>K</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Knaoxtest</div>
          <div style={{ fontSize: 12, color: "var(--lg-glyph-secondary)" }}>Changer la photo de profil</div>
        </div>
      </div>
      <Separator />
      <MenuRow icon={<Users size={ICON} />} label="Changer de profil" />
      <MenuRow icon={<Settings size={ICON} />} label="Paramètres du compte" />
      <MenuRow icon={<Shield size={ICON} />} label="Administration" />
      <Separator />
      <MenuRow icon={<Monitor size={ICON} />} label="Sur cet appareil" />
      <MenuRow icon={<Bell size={ICON} />} label="Notifications" />
      <Separator />
      <MenuRow icon={<LogOut size={ICON} />} label="Déconnexion" danger />
    </LiquidGlass>
  );
}

/** Le menu « Plus » (capture 3) : des sections, jamais des bandes. */
export function LabSurfacePopover({ top, left }: { top: number; left: number }) {
  return (
    <LiquidGlass scale="surface" radius="md" style={{ position: "fixed", top, left, width: 420, padding: "var(--lg-row-inset)", zIndex: 30 }}>
      <SectionLabel>Bibliothèques</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <MenuRow icon={<Sparkles size={ICON} />} label="Animés" />
        <MenuRow icon={<Monitor size={ICON} />} label="Films" />
        <MenuRow icon={<Monitor size={ICON} />} label="Séries" />
      </div>
      <Separator />
      <SectionLabel>Mes listes</SectionLabel>
      <MenuRow icon={<Heart size={ICON} />} label="Mes favoris" />
      <MenuRow icon={<Download size={ICON} />} label="Demander" />
      <Separator />
      <div style={{ padding: "4px 10px 6px", fontSize: 12, color: "var(--lg-glyph-secondary)" }}>
        Texte secondaire : il tient 4,5:1 sur tout dessous.
      </div>
    </LiquidGlass>
  );
}

/** Une entrée de barre latérale : sélection NEUTRE arrondie, l'icône à l'accent. */
function SidebarItem({ icon, label, selected = false }: { icon: ReactNode; label: string; selected?: boolean }) {
  return (
    <div
      style={{
        ...row,
        gap: 10,
        height: 34,
        padding: "0 10px",
        fontSize: 14,
        borderRadius: "var(--lg-row-radius)",
        background: selected ? "var(--lg-sidebar-selection)" : "none",
        fontWeight: selected ? 600 : 400,
      }}
    >
      <span style={{ ...row, color: selected ? "var(--lg-sidebar-selection-glyph)" : "inherit" }}>{icon}</span>
      {label}
    </div>
  );
}

/** La barre latérale de Réglages (capture 2) : plus de dégradé, plus d'entrée violette. */
export function LabSurfaceSidebar({ top, left }: { top: number; left: number }) {
  return (
    <LiquidGlass scale="surface" radius="lg" style={{ position: "fixed", top, left, width: 230, padding: 8, zIndex: 30 }}>
      <SectionLabel>Réglages</SectionLabel>
      <SidebarItem icon={<Palette size={ICON} />} label="Apparence" selected />
      <SidebarItem icon={<Sparkles size={ICON} />} label="Personnalisation" />
      <SidebarItem icon={<Users size={ICON} />} label="Famille" />
      <SidebarItem icon={<Shield size={ICON} />} label="Sécurité" />
      <SidebarItem icon={<Download size={ICON} />} label="Téléchargements" />
    </LiquidGlass>
  );
}
