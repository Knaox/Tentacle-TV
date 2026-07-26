/**
 * Panneau de diagnostic du lecteur — DÉVELOPPEMENT UNIQUEMENT.
 *
 * Un clic, ou F9, et tout ce qui décide de la lecture est à l'écran : quelle
 * coquille répond, quelles capacités elle annonce, ce que le navigateur sait
 * de l'écran, ce que le natif en dit, et l'état de la chaîne couleur de mpv.
 * Les raccourcis basculent les réglages EN DIRECT, seule façon honnête de
 * juger — une capture d'un écran HDR est ramenée en SDR et ne prouve rien.
 *
 * `__PLAYER_DEBUG__` est faux dans tout build livré : ce module et ses voisins
 * disparaissent alors du bundle. Les libellés restent donc en clair, sans
 * passer par i18n — ils ne seront jamais vus par un utilisateur.
 *
 * Opacité et non flou : `backdrop-filter` ne peut PAS échantillonner la vidéo
 * de mpv, qui n'est pas composée par Chromium mais dessinée dans une fenêtre
 * native placée dessous. Un panneau en verre dépoli serait resté vide.
 */

import { useCallback, useEffect, useState } from "react";
import { collecterDebug, type DebugSection } from "./playerDebugData";
import { ACTIONS } from "./playerDebugActions";
import { usePanelDrag } from "./usePanelDrag";

const INTERVALLE_MS = 500;

function couleur(etat: boolean | null): string {
  if (etat === null) return "text-white";
  return etat ? "text-emerald-400" : "text-rose-400";
}

export function PlayerDebugPanel() {
  const [ouvert, setOuvert] = useState(false);
  const [sections, setSections] = useState<DebugSection[]>([]);
  const [retour, setRetour] = useState<string | null>(null);
  const { position, element, onPointerDown } = usePanelDrag({ x: 16, y: 16 });

  const rafraichir = useCallback(() => {
    void collecterDebug().then(setSections);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    rafraichir();
    const t = setInterval(rafraichir, INTERVALLE_MS);
    return () => clearInterval(t);
  }, [ouvert, rafraichir]);

  // F9 ouvre et ferme ; les autres raccourcis n'agissent que panneau ouvert,
  // pour ne jamais entrer en conflit avec ceux du lecteur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "F9") {
        setOuvert((v) => !v);
        return;
      }
      if (!ouvert || e.ctrlKey || e.altKey || e.metaKey) return;
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA")) return;
      const action = ACTIONS.find((a) => a.touche === e.key.toLowerCase());
      if (!action) return;
      e.preventDefault();
      void action.executer().then(setRetour);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [ouvert]);

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="fixed bottom-3 right-3 z-[9999] rounded-md bg-black/80 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-emerald-400 ring-1 ring-emerald-400/40 transition hover:bg-black"
        title="Diagnostic du lecteur (F9) — développement uniquement"
      >
        DEBUG
      </button>
    );
  }

  return (
    <div
      ref={element}
      onPointerDown={onPointerDown}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[9999] max-h-[88vh] w-[430px] cursor-move select-none overflow-y-auto rounded-lg bg-black/92 p-3 font-mono text-[11px] leading-relaxed text-white ring-1 ring-white/15"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-emerald-400">
          DIAGNOSTIC LECTEUR
        </span>
        <button
          onClick={() => setOuvert(false)}
          className="cursor-pointer rounded px-1.5 text-white/50 transition hover:text-white"
          title="Fermer (F9)"
        >
          ×
        </button>
      </div>

      {sections.map((section) => (
        <div key={section.titre} className="mb-2.5">
          <div className="mb-1 border-b border-white/10 pb-0.5 text-[10px] uppercase tracking-wider text-fuchsia-400">
            {section.titre}
          </div>
          {section.lignes.map(([cle, valeur, etat]) => (
            <div key={cle} className="flex justify-between gap-3">
              <span className="shrink-0 text-white/45">{cle}</span>
              <span className={`truncate text-right ${couleur(etat)}`} title={valeur}>
                {valeur}
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="mb-1 border-b border-white/10 pb-0.5 text-[10px] uppercase tracking-wider text-fuchsia-400">
        Bascules en direct
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {ACTIONS.map((action) => (
          <button
            key={action.touche}
            onClick={() => void action.executer().then(setRetour)}
            className="cursor-pointer rounded bg-white/10 px-2 py-1 text-[10px] transition hover:bg-white/20"
          >
            {action.libelle}
          </button>
        ))}
      </div>
      {retour && <div className="mt-2 text-[10px] text-amber-300">{retour}</div>}
    </div>
  );
}
