/**
 * Labo du verre — la vue « composants » (`/dev/verre?vue=composants`).
 *
 * ⚠️ Ce fichier APPARTIENT à lg-composants : les VRAIS composants de l'app,
 * posés sur les mêmes dessous que la vue des surfaces (`?fond=…`), pour les
 * juger en Electron natif avant de les propager — plateau du survol des
 * cartes, ronds, action principale et secondaire, capsule de la fiche,
 * flèche de rangée, menu (avec une ligne de danger).
 *
 * Aucun appel réseau : les boutons ne font rien ; ce sont leurs peaux qu'on
 * regarde. Paquets de développement seulement, comme tout le labo.
 */

import { useState, type CSSProperties, type ReactNode } from "react";

import { CardTrayButton, CardTrayCapsule } from "../../components/cards/CardTrayParts";
import { CardTrayPrimaryButton } from "../../components/cards/CardTrayPrimaryButton";
import { BookmarkGlyph, HeartGlyph, PlayGlyph, WatchedGlyph } from "../../components/cards/cardGlyphs";
import { CapsuleButton, DetailCapsule } from "../../components/detail/DetailActionCapsule";
import { HERO_INFO_PROPS, HERO_PLAY_PROPS } from "../../components/hero/HeroActions";
import { InfoIcon, PlayIcon } from "../../components/icons/HeroIcons";
import { Dropdown } from "../../components/ui/Dropdown";
import { PressableGlass } from "../../components/ui/glass/PressableGlass";

const noop = (): void => undefined;
const TRAY_BOX = "h-8 w-8";
const TRAY_ICON = "h-4 w-4";

function Spot({ top, left, label, children }: { top: number; left: number; label: string; children: ReactNode }) {
  const style: CSSProperties = { position: "absolute", top, left, display: "flex", flexDirection: "column", gap: 8 };
  return (
    <div style={style}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px #000" }}>{label}</span>
      {children}
    </div>
  );
}

export function LabComponents({ top }: { top: number }) {
  const [menuOpen, setMenuOpen] = useState(true);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      <Spot top={top + 40} left={40} label="Plateau du survol (CardTrayParts)">
        <CardTrayCapsule label="Plateau">
          <CardTrayPrimaryButton box={TRAY_BOX} icon={TRAY_ICON} tone="quiet" label="Lire" onPress={noop}>
            <PlayGlyph className={TRAY_ICON} />
          </CardTrayPrimaryButton>
          <CardTrayButton box={TRAY_BOX} label="Ma liste" onPress={noop}><BookmarkGlyph className={TRAY_ICON} /></CardTrayButton>
          <CardTrayButton box={TRAY_BOX} active accent label="Favori" onPress={noop}><HeartGlyph className={TRAY_ICON} filled /></CardTrayButton>
          <CardTrayButton box={TRAY_BOX} label="Vu" onPress={noop}><WatchedGlyph className={TRAY_ICON} /></CardTrayButton>
        </CardTrayCapsule>
        <CardTrayCapsule label="Plateau, demande">
          <CardTrayPrimaryButton box={TRAY_BOX} icon={TRAY_ICON} tone="brand" label="Demander" onPress={noop}>
            <PlayGlyph className={TRAY_ICON} />
          </CardTrayPrimaryButton>
        </CardTrayCapsule>
      </Spot>

      <Spot top={top + 160} left={40} label="Action principale et secondaire (héros, fiche)">
        <div style={{ display: "flex", gap: 10 }}>
          <PressableGlass {...HERO_PLAY_PROPS} onClick={noop}><PlayIcon />Lecture</PressableGlass>
          <PressableGlass {...HERO_INFO_PROPS} onClick={noop}><InfoIcon />Plus d&apos;infos</PressableGlass>
        </div>
      </Spot>

      <Spot top={top + 260} left={40} label="Capsule de la fiche (pastilles)">
        <DetailCapsule>
          <CapsuleButton active={false} onClick={noop} label="Ma liste"><BookmarkGlyph className="h-5 w-5" /></CapsuleButton>
          <CapsuleButton active tone="accent" onClick={noop} label="Favori"><HeartGlyph className="h-5 w-5" filled /></CapsuleButton>
          <CapsuleButton active onClick={noop} label="Vu"><WatchedGlyph className="h-5 w-5" filled /></CapsuleButton>
        </DetailCapsule>
      </Spot>

      <Spot top={top + 360} left={40} label="Flèche de rangée">
        <PressableGlass
          appearance={{ level: "clear", shape: "circle" }}
          className="flex h-10 w-10 items-center justify-center"
          onClick={noop}
          aria-label="Défiler à droite"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </PressableGlass>
      </Spot>

      <Spot top={top + 40} left={560} label="Menu (FloatingLayer .lg-menu)">
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} style={{ color: "#fff", fontSize: 12 }}>
            {menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          </button>
          <Dropdown open={menuOpen} onClose={() => setMenuOpen(false)} placement="bottom-start" minWidth={240}>
            <div className="py-1 text-sm">
              <div className="px-4 py-2 text-content-primary">Mes statistiques</div>
              <div className="px-4 py-2 text-content-primary">Paramètres du compte</div>
              <div className="px-4 py-2 text-content-tertiary">Aide · À propos</div>
              <div className="px-4 py-2 text-status-error-fg">Déconnexion</div>
            </div>
          </Dropdown>
        </div>
      </Spot>
    </div>
  );
}
