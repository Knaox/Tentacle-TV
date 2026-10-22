/**
 * Labo du verre — un exemple de CHAQUE surface, tous par la primitive
 * (`<LiquidGlass>`) et le reflet au pointeur de lg-physique : ce que les
 * composants recevront en héritage. On juge ici, avant de propager.
 *
 * Capsule de navigation, action principale et secondaire, boutons ronds,
 * plateau de survol d'une carte, menu, et le lecteur en PETITS GROUPES de
 * contrôles qui flottent (jamais une dalle pleine largeur).
 */

import type { CSSProperties, ReactNode } from "react";
import {
  Bell,
  Bookmark,
  Check,
  Heart,
  Info,
  LogOut,
  Maximize,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  Users,
  Volume2,
} from "lucide-react";

import {
  GlassSpecular,
  LiquidGlass,
  useSpecularHighlight,
  type LiquidGlassLevel,
  type LiquidGlassRadius,
  type LiquidGlassShape,
} from "../../theme/glass";

interface GlassProps {
  as?: "div" | "button" | "nav";
  level?: LiquidGlassLevel;
  shape?: LiquidGlassShape;
  radius?: LiquidGlassRadius;
  style?: CSSProperties;
  label?: string;
  interactive?: boolean;
  scale?: "control" | "surface";
  children?: ReactNode;
}

/** Une surface de verre ; interactive, elle a le reflet qui suit le pointeur. */
function Glass({ as = "div", interactive = false, label, children, ...rest }: GlassProps) {
  const specular = useSpecularHighlight<HTMLElement>();
  return (
    <LiquidGlass
      as={as as "div"}
      ref={interactive ? specular : undefined}
      interactive={interactive}
      aria-label={label}
      {...(as === "button" ? { type: "button" } : {})}
      {...rest}
    >
      {interactive ? <GlassSpecular /> : null}
      {children}
    </LiquidGlass>
  );
}

const row: CSSProperties = { display: "flex", alignItems: "center" };
const ICON = 18;

/** Une icône DANS un groupe de verre : pas de verre en plus (un verre imbriqué
 * ne voit que son parent et dessine un liseré dans le liseré). */
function Icon({ label, size = 40, children }: { label: string; size?: number; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} style={{ ...row, justifyContent: "center", width: size, height: size, background: "none", border: 0, color: "inherit", borderRadius: size / 2 }}>
      {children}
    </button>
  );
}

function Circle({ label, size = 44, children }: { label: string; size?: number; children: ReactNode }) {
  return (
    <Glass as="button" shape="circle" interactive label={label} style={{ ...row, justifyContent: "center", width: size, height: size, position: "relative" }}>
      {children}
    </Glass>
  );
}

export function LabNav({ top }: { top: number }) {
  const tab = (text: string, active = false) =>
    active ? (
      <Glass as="button" level="tinted" shape="capsule" interactive style={{ ...row, height: 38, padding: "0 16px", fontWeight: 600, position: "relative" }}>
        {text}
      </Glass>
    ) : (
      <button type="button" style={{ height: 38, padding: "0 14px", fontWeight: 500, background: "none", border: 0, color: "inherit" }}>
        {text}
      </button>
    );
  // Les barres de macOS 26 : des GROUPES séparés qui flottent, pas une dalle.
  return (
    <>
      <Glass as="nav" shape="capsule" style={{ ...row, position: "fixed", top, left: 24, height: 54, padding: "0 8px", gap: 4, zIndex: 30 }}>
        <span style={{ fontWeight: 700, padding: "0 14px 0 10px", fontSize: 17 }}>Tentacle TV</span>
        {tab("Accueil", true)}
        {tab("Pour vous")}
        {tab("Films")}
        {tab("Séries")}
      </Glass>
      <div style={{ ...row, position: "fixed", top, right: 24, gap: 10, zIndex: 30 }}>
        <Glass shape="capsule" interactive style={{ ...row, height: 54, width: 280, padding: "0 18px", gap: 10, position: "relative" }}>
          <Search size={17} />
          <span style={{ color: "var(--lg-glyph-secondary)" }}>Titres, acteurs, genres…</span>
        </Glass>
        <Circle label="Notifications" size={54}><Bell size={19} /></Circle>
        <Circle label="Famille" size={54}><Users size={19} /></Circle>
      </div>
    </>
  );
}

export function LabHeroActions({ top }: { top: number }) {
  return (
    <div style={{ ...row, position: "fixed", top, left: 56, gap: 12, zIndex: 20 }}>
      <Glass as="button" level="prominent" shape="capsule" interactive style={{ ...row, height: 52, padding: "0 28px", gap: 10, fontSize: 18, fontWeight: 700, position: "relative" }}>
        <Play size={20} fill="currentColor" /> Lecture
      </Glass>
      <Glass as="button" shape="capsule" interactive style={{ ...row, height: 52, padding: "0 24px", gap: 10, fontSize: 17, fontWeight: 600, position: "relative" }}>
        <Info size={20} /> Plus d'infos
      </Glass>
      <Circle label="Ma liste" size={52}><Plus size={22} /></Circle>
      <Circle label="Favori" size={52}><Heart size={20} /></Circle>
      <Circle label="Vu" size={52}><Check size={20} /></Circle>
    </div>
  );
}

/** Une carte survolée : l'affiche, et son plateau de verre posé dessus. */
export function LabCardTray({ poster, top, left }: { poster?: string; top: number; left: number }) {
  return (
    <div style={{ position: "absolute", top, left, width: 240, height: 360, borderRadius: 18, overflow: "hidden", boxShadow: "0 20px 50px -18px rgba(0,0,0,0.7)", zIndex: 10 }}>
      {poster ? <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} /> : null}
      <Glass shape="capsule" style={{ ...row, position: "absolute", left: 10, right: 10, bottom: 10, height: 46, padding: "0 4px", justifyContent: "space-between" }}>
        <Icon label="Lire" size={38}><Play size={17} fill="currentColor" /></Icon>
        <Icon label="Ma liste" size={38}><Bookmark size={17} /></Icon>
        <Icon label="Favori" size={38}><Heart size={17} /></Icon>
        <Icon label="Vu" size={38}><Check size={17} /></Icon>
      </Glass>
    </div>
  );
}

export function LabMenu({ top }: { top: number }) {
  // Un menu est une GRANDE surface : un ton, tenu (lot lg2).
  const item = (icon: ReactNode, text: string) => (
    <button type="button" style={{ ...row, gap: 12, width: "100%", height: 40, padding: "0 14px", background: "none", border: 0, fontSize: 15, borderRadius: 10 }}>
      {icon}
      {text}
    </button>
  );
  return (
    <Glass radius="lg" scale="surface" style={{ position: "fixed", top, right: 24, width: 280, padding: 8, zIndex: 30 }}>
      <div style={{ ...row, gap: 12, padding: "8px 10px 12px" }}>
        <span style={{ ...row, justifyContent: "center", width: 40, height: 40, borderRadius: 20, fontWeight: 700, color: "#fff", background: "var(--cta-brand-gradient)" }}>K</span>
        <div>
          <div style={{ fontWeight: 600 }}>Knaoxtest</div>
          <div style={{ fontSize: 13, color: "var(--lg-glyph-secondary)" }}>Changer la photo de profil</div>
        </div>
      </div>
      {item(<Settings size={ICON} />, "Paramètres du compte")}
      {item(<Bell size={ICON} />, "Notifications")}
      {item(<Users size={ICON} />, "Famille")}
      <button type="button" style={{ ...row, gap: 12, width: "100%", height: 40, padding: "0 14px", background: "none", border: 0, fontSize: 15, borderRadius: 10, color: "var(--lg-danger)" }}>
        <LogOut size={ICON} />
        Déconnexion
      </button>
    </Glass>
  );
}

/** Le lecteur de macOS 26 : de petits groupes qui flottent, pas une barre pleine. */
export function LabPlayer({ bottom }: { bottom: number }) {
  return (
    <div style={{ ...row, position: "fixed", left: 0, right: 0, bottom, justifyContent: "center", gap: 14, zIndex: 20 }}>
      <Glass level="clear" shape="capsule" style={{ ...row, height: 52, padding: "0 6px", gap: 2 }}>
        <Icon label="Reculer" size={44}><RotateCcw size={19} /></Icon>
        <Icon label="Pause" size={48}><Pause size={22} fill="currentColor" /></Icon>
        <Icon label="Avancer" size={44}><RotateCw size={19} /></Icon>
      </Glass>
      <Glass level="clear" shape="capsule" style={{ ...row, height: 52, width: 420, padding: "0 20px", gap: 14, fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
        <span>0:42:10</span>
        <span style={{ position: "relative", flex: 1, height: 4, borderRadius: 2, background: "var(--lg-glyph-secondary)", opacity: 0.45 }}>
          <span style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "38%", borderRadius: 2, background: "currentColor" }} />
        </span>
        <span>−1:12:08</span>
      </Glass>
      <Glass level="clear" shape="capsule" style={{ ...row, height: 52, padding: "0 6px", gap: 2 }}>
        <Icon label="Volume" size={44}><Volume2 size={19} /></Icon>
        <Icon label="Image dans l'image" size={44}><PictureInPicture2 size={19} /></Icon>
        <Icon label="Plein écran" size={44}><Maximize size={19} /></Icon>
      </Glass>
    </div>
  );
}

/**
 * Le BORD D'UNE RANGÉE : le fondu de défilement (`--row-fade-left`, celui de
 * `RowScrollControls`) et sa flèche, une pastille de verre CLAIR — la même que
 * celle des rangées (`EdgeArrows`, lg-composants).
 */
export function LabRowEdge({ top }: { top: number }) {
  return (
    <div style={{ ...row, position: "fixed", top, left: 0, width: 140, height: 220, padding: "0 6px", background: "var(--row-fade-left)", zIndex: 15 }}>
      <Glass as="button" level="clear" shape="circle" interactive label="Défiler à gauche" style={{ ...row, justifyContent: "center", width: 44, height: 44, position: "relative" }}>
        <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Glass>
    </div>
  );
}
