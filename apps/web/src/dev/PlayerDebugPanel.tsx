/**
 * Le menu de débogage — DÉVELOPPEMENT UNIQUEMENT.
 *
 * Un clic sur DEBUG, ou F9, et deux onglets :
 *  - « Actions » : les bascules, rangées par groupe (lecteur, image et HDR, application,
 *    réseau), chacune avec son ÉTAT — allumée ou non, sa valeur, ou la raison pour laquelle
 *    elle ne peut pas agir sur cette coquille. Les bascules agissent EN DIRECT : c'est la seule
 *    façon honnête de juger (une capture d'un écran HDR est ramenée en SDR et ne prouve rien) ;
 *  - « Diagnostic » : tout ce qui décide de la lecture — quelle coquille répond, ce qu'elle
 *    annonce, ce que le natif dit de l'écran, la chaîne couleur de mpv — et « Copier », pour
 *    l'envoyer depuis une machine que personne d'autre n'a sous la main.
 *
 * `__PLAYER_DEBUG__` est faux dans tout build livré : ce module et ses voisins disparaissent
 * alors du bundle. Les libellés restent donc en clair, sans passer par i18n.
 *
 * Sa peau (`debugMenu/debugMenu.css`) : opaque, sombre dans les deux thèmes, sans flou.
 */

import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useCallback, useEffect, useMemo, useState } from "react";
import { videoShadow } from "../lib/videoShadow";
import { DebugButton } from "./DebugButton";
import { DebugActionsView } from "./debugMenu/DebugActionsView";
import { DebugDiagnosticView } from "./debugMenu/DebugDiagnosticView";
import type { DebugAction } from "./debugMenu/debugActionTypes";
import { copyText, debugReport } from "./debugMenu/debugReport";
import { debugShell } from "./debugMenu/debugShell";
import { useDebugStatuses } from "./debugMenu/useDebugStatuses";
import { collectDebug } from "./playerDebugData";
import type { DebugSection } from "./playerDebugTypes";
import { DEBUG_ACTIONS } from "./playerDebugActions";
import { usePanelDrag } from "./usePanelDrag";
import { usePanelResize } from "./usePanelResize";
import "./debugMenu/debugMenu.css";
import "./debugMenu/debugDiagnostic.css";

const REFRESH_MS = 500;
const TAB_KEY = "tentacle_debug_onglet";

type Tab = "actions" | "diagnostic";
/** Comment le panneau s'est ouvert : au pointeur il se pose (180 ms), au clavier il est là. */
type OpenedBy = "pointer" | "key" | null;

/**
 * Le panneau s'ouvre-t-il d'office ? `?debugpanel` dans l'adresse de départ — que la coquille
 * pose depuis `TENTACLE_DEBUG_PANEL`. Une session de mise au point demande de relancer
 * l'application des dizaines de fois.
 */
function openOnStartup(): OpenedBy {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).has("debugpanel") ? "key" : null;
}

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "diagnostic" ? "diagnostic" : "actions";
  } catch {
    return "actions";
  }
}

export function PlayerDebugPanel() {
  const [openedBy, setOpenedBy] = useState<OpenedBy>(openOnStartup);
  const open = openedBy !== null;
  const [tab, setTab] = useState<Tab>(loadTab);
  const [sections, setSections] = useState<DebugSection[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; at: number } | null>(null);
  const shell = useMemo(debugShell, []);
  const { position, element, onPointerDown, reclamp } = usePanelDrag({ x: 16, y: 16 }, { key: "tentacle_debug_panel_pos" });
  const { size, startResize } = usePanelResize(
    "tentacle_debug_panel_size",
    { w: 460, h: Math.round(Math.min(760, window.innerHeight * 0.88)) },
    // Un panneau agrandi vers le bas/la droite peut déborder : le ramener.
    reclamp,
  );
  const { statuses, refresh: refreshStatuses } = useDebugStatuses(DEBUG_ACTIONS, open && tab === "actions");

  // ⚠️ Le `catch` n'est pas une politesse. Sans lui, une seule collecte qui lève laissait
  // `sections` vide — l'outil censé dire ce qui ne va pas ne disait rien (mesuré : un champ
  // renommé d'un côté du pont de la sonde, et tout le diagnostic muet). L'échec s'affiche DANS
  // le panneau.
  const refresh = useCallback(() => {
    void collectDebug()
      .then(setSections)
      .catch((e: unknown) => {
        setSections([{ title: "Diagnostic en échec", lines: [["erreur", e instanceof Error ? e.message : String(e), false]], emphasis: true }]);
      });
  }, []);

  useEffect(() => {
    if (!open || tab !== "diagnostic") return undefined;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, tab, refresh]);

  const say = useCallback((text: string | null) => {
    if (text !== null) setFeedback({ text, at: Date.now() });
  }, []);

  const run = useCallback((action: DebugAction, choice?: string) => {
    void action.run(choice)
      .then(say, (error: unknown) => say(`${action.label} : ${error instanceof Error ? error.message : String(error)}`))
      // L'état d'une bascule se relit tout de suite : l'interrupteur ne ment pas 700 ms.
      .then(refreshStatuses);
  }, [say, refreshStatuses]);

  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* stockage indisponible : l'onglet vaut pour cette ouverture */
    }
  }, []);

  const copy = useCallback(() => {
    void collectDebug()
      .catch(() => sections)
      .then((fresh) => copyText(debugReport(shell.label, fresh, DEBUG_ACTIONS, statuses)))
      .then((ok) => say(ok ? "diagnostic copié dans le presse-papiers" : "copie refusée par cette coquille"));
  }, [sections, shell.label, statuses, say]);

  // F9 ouvre et ferme ; les autres raccourcis n'agissent que panneau ouvert, pour ne jamais
  // entrer en conflit avec ceux du lecteur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "F9") {
        setOpenedBy((v) => (v === null ? "key" : null));
        return;
      }
      if (!open || e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const action = DEBUG_ACTIONS.find((a) => a.key === e.key.toLowerCase());
      if (!action) return;
      e.preventDefault();
      if (statuses.get(action.id)?.unavailable !== undefined) {
        say(`${action.label} : ${statuses.get(action.id)?.unavailable ?? ""}`);
        return;
      }
      run(action);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, run, say, statuses]);

  if (!open) return <DebugButton onOpen={() => setOpenedBy("pointer")} />;

  return (
    <div
      ref={(el) => {
        element.current = el;
      }}
      role="dialog"
      aria-label="Menu de débogage"
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: size.h,
        // Pas d'ombre floue là où la surface a un canal alpha : elle y sort en aplat noir bien
        // plus grand que le panneau (`videoShadow`).
        boxShadow: videoShadow("0 0 0 1px rgba(255,255,255,0.14), 0 24px 64px -12px rgba(0,0,0,0.9)", "0 0 0 1px rgba(255,255,255,0.2)"),
      }}
      className={`dbg dbg-panel ${openedBy === "pointer" ? "dbg-panel--pointer" : ""}`}
    >
      {/* On le déplace par son EN-TÊTE : ailleurs, une valeur se sélectionne et se copie. */}
      <div className="dbg-head" onPointerDown={onPointerDown}>
        <span className="dbg-title">Débogage</span>
        <span className="dbg-shell" title="La coquille qui répond : c'est elle qui décide de ce qui marche.">{shell.label}</span>
        <span className="dbg-grow" />
        <button type="button" className="dbg-iconbtn" onClick={copy} title="Copier le diagnostic (texte)">Copier</button>
        <button type="button" className="dbg-iconbtn" onClick={() => setOpenedBy(null)} title="Fermer (F9)" aria-label="Fermer">
          <XIcon size={14} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="dbg-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "actions"} className="dbg-tab" onClick={() => selectTab("actions")}>Actions</button>
        <button type="button" role="tab" aria-selected={tab === "diagnostic"} className="dbg-tab" onClick={() => selectTab("diagnostic")}>Diagnostic</button>
      </div>

      {/* Le contenu défile DANS ce conteneur ; le retour et la poignée restent collés au bas. */}
      <div className="dbg-body" role="tabpanel">
        {tab === "actions"
          ? <DebugActionsView actions={DEBUG_ACTIONS} statuses={statuses} onRun={run} />
          : <DebugDiagnosticView sections={sections} />}
      </div>

      <div className="dbg-foot" role="status">
        {feedback ? (
          <>
            <span className="dbg-foot__dot" aria-hidden />
            <span key={feedback.at} className="dbg-foot__text">{feedback.text}</span>
          </>
        ) : (
          <span>F9 ouvre et ferme · une lettre lance son action</span>
        )}
      </div>
      <div onPointerDown={startResize} className="dbg-resize" title="Redimensionner" aria-hidden>
        <svg viewBox="0 0 10 10" width="10" height="10"><path d="M9 1v8H1" fill="none" stroke="currentColor" /></svg>
      </div>
    </div>
  );
}
