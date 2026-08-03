import { formatDuration } from "@/components/playerControls/utils";

/**
 * La barre de progression du téléviseur.
 *
 * **Jamais focusable, et c'est déjà vrai du web** : la barre y est un
 * `role="slider"` sans `tabindex`, que le recensement du moteur ne voit pas.
 * Une poignée qu'on ne peut pas saisir n'a pas à être une cible ; le
 * déplacement dans le flux passe par le curseur fantôme, pas par elle.
 *
 * Aucun gestionnaire de souris non plus — ni survol, ni aperçu au pointeur. Ce
 * qu'elle montre, elle le montre en permanence.
 *
 * Le curseur fantôme est rendu par le même composant que la progression réelle,
 * à une position différente : c'est ce qui garantit qu'ils sont alignés au
 * pixel, et qu'on lit d'un coup d'œil la distance entre les deux.
 */

interface ProprietesBarre {
  currentTime: number;
  duration: number;
  buffered: number;
  /** Position du curseur fantôme, ou `null` hors déplacement. */
  fantome?: number | null;
}

function pourcent(valeur: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, (valeur / total) * 100));
}

export function BarreProgressionTv({
  currentTime,
  duration,
  buffered,
  fantome = null,
}: ProprietesBarre) {
  const lu = pourcent(currentTime, duration);
  const charge = pourcent(buffered, duration);
  const vise = fantome === null ? null : pourcent(fantome, duration);

  return (
    <div className="barre-tv">
      <span className="barre-tv-temps">{formatDuration(fantome ?? currentTime)}</span>

      <div
        className="barre-tv-piste"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(fantome ?? currentTime)}
      >
        <span className="barre-tv-tampon" style={{ width: `${charge}%` }} />
        <span className="barre-tv-lu" style={{ width: `${lu}%` }} />
        <span className="barre-tv-pastille" style={{ left: `${lu}%` }} />
        {vise !== null && <span className="barre-tv-fantome" style={{ left: `${vise}%` }} />}
      </div>

      <span className="barre-tv-temps">{formatDuration(duration)}</span>
    </div>
  );
}
