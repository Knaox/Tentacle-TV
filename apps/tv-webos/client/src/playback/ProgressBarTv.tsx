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

interface BarProps {
  currentTime: number;
  duration: number;
  /**
   * Ce qui est déjà chargé, en FRACTION de la durée — de 0 à 1.
   *
   * L'unité est dans le nom parce qu'elle a coûté cher : la propriété
   * s'appelait `buffered` et cette barre la divisait par la durée, comme si
   * c'était des secondes. Elle vient du lecteur web, qui rend déjà un rapport.
   * Un film de deux heures chargé à 35 % affichait donc `0,35 / 7200` — zéro
   * pixel, toujours, depuis le premier jour. La couche était bien rendue, elle
   * n'a simplement jamais eu de largeur.
   *
   * L'erreur venait d'un portage depuis l'application Android TV, où la valeur
   * était en secondes et documentée comme telle. Les deux types étant `number`,
   * et la substitution de modules étant un greffon de build que `tsc` ne
   * connaît pas, rien ne pouvait le signaler.
   */
  bufferedFraction: number;
  /** Position du curseur fantôme, ou `null` hors déplacement. */
  ghost?: number | null;
}

function percent(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

/** Une fraction de 0 à 1, bornée, en pourcentage. */
function percentOfFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(100, Math.max(0, fraction * 100));
}

export function BarreProgressionTv({
  currentTime,
  duration,
  bufferedFraction,
  ghost = null,
}: BarProps) {
  const lu = percent(currentTime, duration);
  const loaded = percentOfFraction(bufferedFraction);
  const vise = ghost === null ? null : percent(ghost, duration);

  return (
    <div className="barre-tv">
      <span className="barre-tv-temps">{formatDuration(ghost ?? currentTime)}</span>

      <div
        className="barre-tv-piste"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(ghost ?? currentTime)}
      >
        <span className="barre-tv-tampon" style={{ width: `${loaded}%` }} />
        <span className="barre-tv-lu" style={{ width: `${lu}%` }} />
        <span className="barre-tv-pastille" style={{ left: `${lu}%` }} />
        {vise !== null && <span className="barre-tv-fantome" style={{ left: `${vise}%` }} />}
      </div>

      <span className="barre-tv-temps">{formatDuration(duration)}</span>
    </div>
  );
}
