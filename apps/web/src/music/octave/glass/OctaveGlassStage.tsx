/**
 * Octave en Liquid Glass (mode natif, bureau) — la DISPOSITION de la maquette
 * « Octave · Playlist » : sur le fond coloré d'Octave (`OctaveAmbient`, une
 * seule couche FIXE), le rail, la page et la file posés à 20 px des bords, et le
 * dock qui flotte au bas de TOUTE la fenêtre, centré. Le rail et la file
 * s'arrêtent au-dessus du dock ; la page, elle, défile dessous (le verre du dock
 * a quelque chose à voir passer).
 *
 * La scène suit le THÈME (encre et taches vives en sombre, nacre et taches pastel
 * en clair : les jetons du socle) ; seul le dock reste la nuit d'Octave.
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
    <div className="octave-stage fixed inset-0" style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="desktop" data-octave-stage>
      <OctaveAmbient />
      <div className="octave-stage-row">
        {sidebar}
        <main ref={mainRef} id="octave-main" className="octave-stage-main">
          {children}
        </main>
        {queue && <div className="octave-drawer octave-stage-queue lg-pane">{queue}</div>}
      </div>
      {dock}
      {overlays}
    </div>
  );
}
