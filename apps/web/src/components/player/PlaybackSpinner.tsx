import { memo } from "react";
import { usePlayerGlassMode } from "./glass/PlayerGlassContext";
import { isGlassLayout } from "./glass/playerGlassMode";
import { GlassSurface } from "./glass/GlassSurface";

/**
 * L'indicateur d'attente EN COURS de lecture (réseau qui cale, saut pendant
 * un transcodage) et, quand l'attente dure, sa phrase dessous (« Le serveur
 * prépare la vidéo à ce passage… », `player/transcodeSeek.ts`). Posé sur la
 * vidéo : blanc en dur dans les deux thèmes ; la phrase sur un voile sombre
 * pour rester lisible sur une image claire. Sans flou ni animation de plus
 * que la rotation du cercle.
 *
 * `spinner-lecture` n'habille rien ici : c'est la prise que le téléviseur
 * utilise pour l'agrandir, quarante-huit pixels étant illisibles à trois
 * mètres. Le web garde sa taille.
 */
export const PlaybackSpinner = memo(function PlaybackSpinner({ hint, layer = "z-10" }: { hint?: string; layer?: string }) {
  // Lecteur de bureau en verre : le cercle dans une bulle de verre, la phrase dans une capsule —
  // pistes PLEINES (un blanc translucide grise sur la surface à alpha de macOS).
  if (isGlassLayout(usePlayerGlassMode())) {
    return (
      <div className={`pointer-events-none absolute inset-0 ${layer} flex flex-col items-center justify-center gap-4 px-6`}>
        <GlassSurface className="lgp-badge lgp-badge--spinner" group="player-flash" variant="regular">
          <div className="lgp-spinner spinner-lecture animate-spin rounded-full motion-reduce:animate-[spin_2.4s_linear_infinite]" />
        </GlassSurface>
        {hint && (
          <GlassSurface className="lgp-badge" group="player-flash" variant="regular">
            <p role="status" aria-live="polite" className="max-w-sm px-4 py-1.5 text-center text-sm">{hint}</p>
          </GlassSurface>
        )}
      </div>
    );
  }
  return (
    <div className={`pointer-events-none absolute inset-0 ${layer} flex flex-col items-center justify-center gap-4 px-6`}>
      <div className="spinner-lecture h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white motion-reduce:animate-[spin_2.4s_linear_infinite]" />
      {hint && (
        <p role="status" aria-live="polite" className="max-w-sm rounded-full bg-black/60 px-4 py-1.5 text-center text-sm text-white/90">
          {hint}
        </p>
      )}
    </div>
  );
});
