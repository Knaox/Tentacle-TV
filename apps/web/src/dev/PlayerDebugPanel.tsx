/**
 * Panneau de diagnostic du lecteur — DÉVELOPPEMENT UNIQUEMENT.
 *
 * Un bouton, un clic, et tout ce qui décide de la lecture est à l'écran :
 * quelle coquille répond, quelles capacités elle annonce, ce que le navigateur
 * sait de l'écran, ce que le natif en dit, et l'état de la chaîne couleur de
 * mpv.
 *
 * L'appelant est gardé par `import.meta.env.DEV`, que Vite remplace par
 * `false` en production : ce module entier disparaît du bundle livré. Les
 * libellés restent donc en clair, sans passer par i18n — ils ne seront jamais
 * vus par un utilisateur.
 *
 * Opacité et non flou : `backdrop-filter` ne peut PAS échantillonner la vidéo
 * de mpv, qui n'est pas composée par Chromium mais dessinée dans une fenêtre
 * native placée dessous. Un panneau en verre dépoli serait resté vide.
 */

import { useCallback, useEffect, useState } from "react";
import { collecterDebug, type DebugSection } from "./playerDebugData";

const INTERVALLE_MS = 500;

function couleur(etat: boolean | null): string {
  if (etat === null) return "text-white";
  return etat ? "text-emerald-400" : "text-rose-400";
}

export function PlayerDebugPanel() {
  const [ouvert, setOuvert] = useState(false);
  const [sections, setSections] = useState<DebugSection[]>([]);

  const rafraichir = useCallback(() => {
    void collecterDebug().then(setSections);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    rafraichir();
    const t = setInterval(rafraichir, INTERVALLE_MS);
    return () => clearInterval(t);
  }, [ouvert, rafraichir]);

  // Bascule aussi au clavier : le lecteur est souvent en plein écran, où viser
  // un bouton de coin est pénible.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") setOuvert((v) => !v);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

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
    <div className="fixed bottom-3 right-3 z-[9999] max-h-[85vh] w-[420px] overflow-y-auto rounded-lg bg-black/92 p-3 font-mono text-[11px] leading-relaxed text-white ring-1 ring-white/15">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-emerald-400">
          DIAGNOSTIC LECTEUR
        </span>
        <button
          onClick={() => setOuvert(false)}
          className="rounded px-1.5 text-white/50 transition hover:text-white"
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
    </div>
  );
}
