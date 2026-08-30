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
 * Fond OPAQUE, et pas seulement sombre : posé sur une vidéo claire, un panneau
 * translucide devient illisible au pire moment — celui où l'on cherche à lire
 * une valeur. Et pas de `backdrop-filter` non plus : il ne peut PAS
 * échantillonner l'image de mpv, qui n'est pas composée par Chromium mais
 * dessinée dans une fenêtre native placée dessous. Un panneau en verre dépoli
 * serait resté vide.
 */

import { useCallback, useEffect, useState } from "react";
import { videoShadow } from "../lib/videoShadow";
import { DebugButton } from "./DebugButton";
import { collectDebug } from "./playerDebugData";
import type { DebugSection } from "./playerDebugTypes";
import { DEBUG_ACTIONS } from "./playerDebugActions";
import { usePanelDrag } from "./usePanelDrag";
import { usePanelResize } from "./usePanelResize";

const REFRESH_MS = 500;

function colorClass(state: boolean | null): string {
  if (state === null) return "text-white";
  return state ? "text-emerald-400" : "text-rose-400";
}

/**
 * Le panneau s'ouvre-t-il d'office ?
 *
 * `?debugpanel` dans l'adresse de départ — que la coquille Electron pose depuis
 * `TENTACLE_DEBUG_PANEL`. Une session de mise au point du rendu demande de
 * relancer l'application des dizaines de fois, et rouvrir le panneau à la main
 * à chaque fois finit par décider de ce qu'on observe.
 */
function openOnStartup(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("debugpanel");
}

export function PlayerDebugPanel() {
  const [open, setOpen] = useState(openOnStartup);
  const [sections, setSections] = useState<DebugSection[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { position, element, onPointerDown, reclamp } = usePanelDrag(
    { x: 16, y: 16 },
    { key: "tentacle_debug_panel_pos" },
  );
  const { size, startResize } = usePanelResize(
    "tentacle_debug_panel_size",
    { w: 480, h: Math.round(window.innerHeight * 0.88) },
    // Un panneau agrandi vers le bas/la droite peut déborder : le ramener.
    reclamp,
  );

  // ⚠️ Le `catch` n'est pas une politesse. Sans lui, une seule collecte qui
  // lève laissait `sections` vide et le panneau n'affichait plus que ses
  // bascules — l'outil censé dire ce qui ne va pas ne disait rien, et il
  // fallait la console pour l'apprendre (mesuré : un champ renommé d'un côté
  // du pont de la sonde, `edr.courant` devenu `edr.current`, et tout le
  // diagnostic muet). L'échec s'affiche donc DANS le panneau.
  const refresh = useCallback(() => {
    void collectDebug()
      .then(setSections)
      .catch((e: unknown) => {
        setSections([
          {
            title: "Diagnostic en échec",
            lines: [["erreur", e instanceof Error ? e.message : String(e), false]],
            emphasis: true,
          },
        ]);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [open, refresh]);

  // F9 ouvre et ferme ; les autres raccourcis n'agissent que panneau ouvert,
  // pour ne jamais entrer en conflit avec ceux du lecteur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "F9") {
        setOpen((v) => !v);
        return;
      }
      if (!open || e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const action = DEBUG_ACTIONS.find((a) => a.key === e.key.toLowerCase());
      if (!action) return;
      e.preventDefault();
      void action.run().then(setFeedback);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return <DebugButton onOpen={() => setOpen(true)} />;
  }

  return (
    <div
      ref={(el) => {
        element.current = el;
      }}
      onPointerDown={onPointerDown}
      style={{
        left: position.x,
        top: position.y,
        // Taille pilotée par la poignée du coin — plus de largeur figée.
        width: size.w,
        height: size.h,
        // Opaque, franchement : voir l'en-tête du fichier.
        background: "#0a0a10",
        // Et pas d'ombre floue là où la surface a un canal alpha : elle y sort
        // en aplat noir bien plus grand que le panneau. Voir `videoShadow`.
        boxShadow: videoShadow("0 24px 64px -12px rgba(0,0,0,0.9)", "none"),
      }}
      className="fixed z-[9999] cursor-move select-none rounded-lg font-mono text-[11px] leading-relaxed text-white ring-1 ring-white/20"
    >
      {/* Le contenu défile DANS ce conteneur ; la poignée, elle, reste collée
          au coin du panneau — absolue dans le parent fixe, hors du défilement. */}
      <div className="h-full overflow-y-auto p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-wider text-emerald-400">
          DIAGNOSTIC LECTEUR
        </span>
        <button
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded px-1.5 text-white/50 transition hover:text-white"
          title="Fermer (F9)"
        >
          ×
        </button>
      </div>

      {sections.map((section) => (
        <div
          key={section.title}
          className={section.emphasis ? "mb-3 rounded-md bg-white/[0.06] p-2.5" : "mb-2.5"}
        >
          <div className="mb-1 border-b border-white/10 pb-0.5 text-[10px] uppercase tracking-wider text-fuchsia-400">
            {section.title}
          </div>
          {section.lines.map(([key, value, state]) =>
            // Les verdicts se lisent en ligne, valeur à GAUCHE et sur toute la
            // largeur : ce sont des phrases, pas des valeurs à aligner.
            section.emphasis ? (
              <div key={key} className="mt-1 flex gap-2 text-[12px] leading-snug">
                <span className="w-[68px] shrink-0 text-white/45">{key}</span>
                <span className={`flex-1 font-semibold ${colorClass(state)}`}>{value}</span>
              </div>
            ) : (
              <div key={key} className="flex justify-between gap-3">
                <span className="shrink-0 text-white/45">{key}</span>
                <span className={`truncate text-right ${colorClass(state)}`} title={value}>
                  {value}
                </span>
              </div>
            ),
          )}
        </div>
      ))}

      <div className="mb-1 border-b border-white/10 pb-0.5 text-[10px] uppercase tracking-wider text-fuchsia-400">
        Bascules en direct
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {DEBUG_ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => void action.run().then(setFeedback)}
            className="cursor-pointer rounded bg-white/10 px-2 py-1 text-[10px] transition hover:bg-white/20"
          >
            {action.label}
          </button>
        ))}
      </div>
      {feedback && <div className="mt-2 text-[10px] text-amber-300">{feedback}</div>}
      </div>
      <div
        onPointerDown={startResize}
        className="absolute bottom-0 right-0 flex h-4 w-4 cursor-nwse-resize items-end justify-end p-0.5 text-white/30 hover:text-white/80"
        title="Redimensionner"
      >
        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
          <path d="M9 1v8H1" fill="none" stroke="currentColor" />
        </svg>
      </div>
    </div>
  );
}
