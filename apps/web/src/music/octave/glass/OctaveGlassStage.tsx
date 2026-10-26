/**
 * Octave en Liquid Glass (mode natif, bureau) — la DISPOSITION de la maquette
 * « Octave · Playlist » : sur le fond coloré d'Octave (`OctaveAmbient`, une
 * seule couche FIXE), le rail, la page et la file posés à 20 px des bords, et le
 * dock qui flotte au bas de TOUTE la fenêtre, centré. Le rail et la file
 * s'arrêtent au-dessus du dock ; la page, elle, défile dessous (le verre du dock
 * a quelque chose à voir passer).
 *
 * La scène est la NUIT d'Octave (`octave-night`) dans les deux thèmes, comme le
 * dock : la maquette est une encre, et ses taches de couleur n'ont de sens que
 * sur elle. Les menus et feuilles portés hors de la scène suivent le thème.
 *
 * Seulement sous `data-liquid-glass="native"` : `OctaveShell` ne la monte que là.
 * Mesures et matériaux : `octaveStage.css`.
 */

import type { ReactNode, RefObject } from "react";
import { OctaveAmbient } from "./OctaveAmbient";

interface OctaveGlassStageProps {
  mainRef: RefObject<HTMLElement | null>;
  sidebar: ReactNode;
  dock: ReactNode;
  /** La file d'attente, ouverte ; `null` fermée (démontée : rien ne coûte). */
  queue: ReactNode;
  overlays: ReactNode;
  children: ReactNode;
}

export function OctaveGlassStage({ mainRef, sidebar, dock, queue, overlays, children }: OctaveGlassStageProps) {
  return (
    <div className="octave-stage octave-night fixed inset-0" style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="desktop" data-octave-stage>
      <OctaveAmbient />
      <div className="octave-stage-row">
        {sidebar}
        <main ref={mainRef} id="octave-main" className="octave-stage-main">
          {children}
        </main>
        {queue && <div className="octave-drawer octave-stage-queue">{queue}</div>}
      </div>
      {dock}
      {overlays}
    </div>
  );
}
