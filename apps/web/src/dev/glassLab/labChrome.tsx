/**
 * Labo du verre — la vue « barres » (`/dev/verre?vue=barres`), à l'axe des
 * barres : les VRAIS composants, pas des imitations — la barre du haut
 * (`TopNav` : groupes, onglet courant, « Plus », recherche, boutons, avatar)
 * et une barre latérale (`SettingsShell` + `useGlassSidebar`, celle de
 * Réglages et d'Administration) — posés sur les dessous du labo.
 *
 * La page est plus haute que la fenêtre : en la défilant, le dessous passe
 * sous la barre, et l'effet de bord de défilement (`ScrollEdgeEffect`, monté
 * par le bandeau) se juge sur de vrais contenus. `?defile=<px>` la défile à
 * l'ouverture (bancs reproductibles).
 *
 * Styles en ligne seulement, comme le reste du labo.
 */

import { useEffect, useState } from "react";
import { Database, Palette, Play, Shield, Sparkles, Users } from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";

import { TopNav } from "../../components/nav/TopNav";
import { useGlassSidebar } from "../../components/nav/useGlassSidebar";

const ICON = 18;

const SECTIONS: SettingsShellSection[] = [
  { id: "appearance", label: "Apparence", icon: <Palette size={ICON} /> },
  { id: "personal", label: "Personnalisation", icon: <Sparkles size={ICON} /> },
  { id: "family", label: "Famille", icon: <Users size={ICON} /> },
  { id: "security", label: "Sécurité", icon: <Shield size={ICON} />, group: "Compte" },
  { id: "playback", label: "Lecture", icon: <Play size={ICON} />, group: "Compte" },
  { id: "data", label: "Données", icon: <Database size={ICON} />, group: "Compte" },
];

function LabSidebar({ top }: { top: number }) {
  const [active, setActive] = useState("appearance");
  const sidebar = useGlassSidebar("lab");
  return (
    // Par-dessus le dessous (qui est dans le flux), sur toute la hauteur de
    // la page : le rail y colle sous la barre (`md:sticky`) pendant qu'elle défile.
    <div style={{ position: "absolute", inset: "0 0 auto 0", paddingTop: top, zIndex: 10 }}>
      <SettingsShell
        sections={SECTIONS}
        activeId={active}
        onSelect={setActive}
        navLabel="Labo"
        selectionIndicator={sidebar.selection}
        sidebarSurface={sidebar.surface}
      >
        {/* Le détail reste vide : seul le rail se juge ici (le contenu est à l'axe D). */}
        <div style={{ height: "220vh" }} />
      </SettingsShell>
    </div>
  );
}

export function LabChrome({ top }: { top: number }) {
  useEffect(() => {
    const asked = Number(new URLSearchParams(window.location.search).get("defile"));
    if (asked > 0) requestAnimationFrame(() => window.scrollTo(0, asked));
  }, []);
  return (
    <>
      <TopNav />
      <LabSidebar top={top + 70} />
    </>
  );
}
