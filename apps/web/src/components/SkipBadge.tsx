import { FastForwardIcon, RewindIcon } from "./icons/transport";

export interface SkipFlash {
  delta: number;
  id: number;
}

/**
 * Badge éphémère « +30s / −10s » après un saut (boutons ±10/30, flèches
 * clavier, swipe) — pilule latérale côté du sens du saut, façon Netflix.
 *
 * Posé sur la vidéo → l'encre des capsules et le blanc, en dur dans les deux
 * thèmes clair/sombre.
 *
 * Et donc PAS de `backdrop-filter`. Sur les trois bureaux, mpv ne dessine pas
 * dans le moteur web : Windows lui donne une fenêtre native placée SOUS la
 * surface de Chromium, macOS et Linux une couche GL sous la webview. Le moteur
 * ne voit jamais l'image du film, il ne peut donc pas l'échantillonner. Un flou
 * posé ici ne floutait rien et coûtait quand même une couche composée par
 * image. Ne pas le remettre.
 *
 * La même pilule d'encre sous le Liquid Glass : comme les commandes, un badge n'est pas en verre
 * (cf. `PlaybackBadge`).
 */
export function SkipBadge({ flash }: { flash: SkipFlash | null }) {
  if (!flash) return null;
  const forward = flash.delta > 0;
  const label = forward ? `+${flash.delta}s` : `−${Math.abs(flash.delta)}s`;

  return (
    <div
      key={flash.id}
      className={`pointer-events-none absolute top-[45%] z-30 ${forward ? "right-10 md:right-24" : "left-10 md:left-24"}`}
    >
      <div className="flex animate-[fadeIn_0.12s_ease] items-center gap-2 rounded-pill bg-[rgba(24,24,27,0.74)] px-5 py-2.5">
        {!forward && <RewindIcon className="h-5 w-5 text-white" aria-hidden />}
        <span className="text-lg font-extrabold tabular-nums text-white">{label}</span>
        {forward && <FastForwardIcon className="h-5 w-5 text-white" aria-hidden />}
      </div>
    </div>
  );
}
