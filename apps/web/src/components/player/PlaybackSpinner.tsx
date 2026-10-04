import { memo } from "react";

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
export const PlaybackSpinner = memo(function PlaybackSpinner({ hint }: { hint?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6">
      <div className="spinner-lecture h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white motion-reduce:animate-[spin_2.4s_linear_infinite]" />
      {hint && (
        <p role="status" aria-live="polite" className="max-w-sm rounded-full bg-black/60 px-4 py-1.5 text-center text-sm text-white/90">
          {hint}
        </p>
      )}
    </div>
  );
});
