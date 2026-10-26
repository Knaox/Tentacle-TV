/**
 * LABO DU VERRE — `/dev/verre`, paquets de développement seulement (Vite en
 * dev, ou `build:web:debug` du bureau : `__PLAYER_DEBUG__`), JAMAIS livré.
 *
 * On y juge le matériau et la lentille AVANT de les propager (méthode de la
 * refonte du 22/10, `.claude/locks/lg/REFONTE-VERRE.md`) : de vrais dessous
 * détaillés (`labBackdrop.tsx`), un exemple de chaque surface par la primitive
 * (`labSurfaces.tsx`), les deux thèmes, et ce que la page sait du ton dessous.
 *
 * `?fond=affiches|illustrations|texte|mire|brun|blanc|noir|mixte` choisit le
 * dessous à l'ouverture (bancs reproductibles) ; `?vue=grandes` montre les
 * GRANDES surfaces du régime `surface` (lot lg2 : menu, popover, barre
 * latérale — `labLargeSurfaces.tsx`) ; `?vue=composants` montre les VRAIS
 * composants de lg-composants (`labComponents.tsx`, à eux) au lieu des
 * surfaces de la primitive ; `?vue=barres` la VRAIE barre du haut et une
 * vraie barre latérale (`labChrome.tsx`, axe des barres) ; `?vue=menus` les
 * VRAIS menus et popovers (`labMenus.tsx`, axe des menus) ; `?vue=contenu` la
 * couche de contenu (`labContent.tsx`, axe D du lot lg2) ; `?vue=controles` les CONTRÔLES des
 * pages en verre (`labControls.tsx`, lot lg4) ; `?vue=feuilles` les VRAIES feuilles et barres
 * flottantes (`labSheets.tsx`, lot lg7) ; `?vue=maquette` le verre de la maquette du
 * 26/10 en socle (`labMockup.tsx` : fond ambiant, `.lg-pane`, `.lg-bead`). Hors du mode natif, le labo montre le
 * rendu d'avant : c'est aussi une preuve.
 */

import { useEffect, useState, useSyncExternalStore } from "react";

import { hostTitleBarHeight } from "../../desktop/hostChrome";
import { getScheme, setMode, subscribe as subscribeScheme } from "../../theme/colorScheme";
import { useLiquidGlassMode } from "../../theme/glass";
import { backdropToneMeasured } from "../../theme/glass/useBackdropTone";
import { LAB_BACKDROPS, LabBackdropView, type LabBackdrop } from "./labBackdrop";
import { LabChrome } from "./labChrome";
import { LabComponents } from "./labComponents";
import { LabContent } from "./labContent";
import { LabControls } from "./labControls";
import { LabSurfaceMenu, LabSurfacePopover, LabSurfaceSidebar } from "./labLargeSurfaces";
import { LabMenus } from "./labMenus";
import { LabMockup } from "./labMockup";
import { LabSheets } from "./labSheets";
import { LabCardTray, LabHeroActions, LabMenu, LabNav, LabPlayer, LabRowEdge } from "./labSurfaces";
import { AVATAR_CHARACTERS } from "@tentacle-tv/shared";
import { avatarImageUrl } from "../../profiles/avatarGallery/avatarImages";

function initialBackdrop(): LabBackdrop {
  const asked = new URLSearchParams(window.location.search).get("fond");
  return LAB_BACKDROPS.find((b) => b === asked) ?? "affiches";
}

type LabView = "surfaces" | "composants" | "grandes" | "barres" | "menus" | "contenu" | "controles" | "feuilles" | "maquette";

const LAB_VIEWS: readonly LabView[] = ["surfaces", "grandes", "composants", "barres", "menus", "contenu", "controles", "feuilles", "maquette"];

const initialView = (): LabView => {
  const asked = new URLSearchParams(window.location.search).get("vue");
  return LAB_VIEWS.find((v) => v === asked) ?? "surfaces";
};

const chip = (active: boolean) => ({
  padding: "4px 9px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.4)",
  background: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "inherit",
  fontSize: 12,
});

interface LabPanelProps {
  backdrop: LabBackdrop;
  onBackdrop: (b: LabBackdrop) => void;
  view: LabView;
  onView: (v: LabView) => void;
}

function LabPanel({ backdrop, onBackdrop, view, onView }: LabPanelProps) {
  const mode = useLiquidGlassMode();
  const scheme = useSyncExternalStore(subscribeScheme, getScheme, getScheme);
  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        width: 224,
        padding: 10,
        borderRadius: 12,
        background: scheme === "light" ? "#fff" : "#151519",
        color: scheme === "light" ? "#111" : "#eee",
        fontSize: 12,
        zIndex: 50,
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Labo du verre</div>
      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 6 }}>
        {LAB_BACKDROPS.map((b) => (
          <button key={b} type="button" onClick={() => onBackdrop(b)} style={{ ...chip(b === backdrop), margin: 2 }}>
            {b}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 6 }}>
        {LAB_VIEWS.map((v) => (
          <button key={v} type="button" onClick={() => onView(v)} style={{ ...chip(view === v), margin: 2 }}>{v}</button>
        ))}
      </div>
      <div style={{ display: "flex", marginBottom: 6 }}>
        <button type="button" onClick={() => setMode("dark")} style={{ ...chip(scheme === "dark"), margin: 2 }}>sombre</button>
        <button type="button" onClick={() => setMode("light")} style={{ ...chip(scheme === "light"), margin: 2 }}>clair</button>
      </div>
      <div>mode : {mode}</div>
      <div>ton : {backdropToneMeasured() ? "mesuré par la coquille" : "celui du thème"}</div>
    </div>
  );
}

export function GlassLab() {
  const [backdrop, setBackdrop] = useState<LabBackdrop>(initialBackdrop);
  const [view, setView] = useState<LabView>(initialView);
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const top = hostTitleBarHeight() + 14;
  const poster = avatarImageUrl(AVATAR_CHARACTERS[3]?.id ?? "bip");

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {view === "maquette" ? <LabMockup top={top} poster={poster} /> : <LabBackdropView kind={backdrop} />}
      {view === "maquette" ? null : view === "menus" ? (
        <LabMenus top={top} />
      ) : view === "barres" ? (
        <LabChrome top={top} />
      ) : view === "composants" ? (
        <LabComponents top={top} />
      ) : view === "contenu" ? (
        <LabContent top={top} />
      ) : view === "controles" ? (
        <LabControls top={top} />
      ) : view === "feuilles" ? (
        <LabSheets top={top} />
      ) : view === "grandes" ? (
        <>
          <LabSurfaceSidebar top={top + 40} left={24} />
          <LabSurfacePopover top={top + 120} left={Math.max(280, width / 2 - 240)} />
          <LabSurfaceMenu top={top + 10} right={24} />
        </>
      ) : (
        <>
          <LabCardTray poster={poster} top={top + 300} left={Math.max(24, width - 360)} />
          <LabNav top={top} />
          <LabMenu top={top + 66} />
          <LabRowEdge top={top + 200} />
          <LabHeroActions top={top + 470} />
          <LabPlayer bottom={24} />
        </>
      )}
      <LabPanel backdrop={backdrop} onBackdrop={setBackdrop} view={view} onView={setView} />
    </div>
  );
}
