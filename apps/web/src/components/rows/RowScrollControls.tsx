import { PressableScale } from "../ui/PressableScale";

interface RowScrollControlsProps {
  canLeft: boolean;
  canRight: boolean;
  /**
   * Les zones sont-elles DANS le DOM ? Piloté par `useHoverMount` chez
   * l'appelant : vrai pendant le survol de la rangée, et le temps du fondu de
   * sortie.
   */
  mounted: boolean;
  /** Cible du fondu — vrai tant que le curseur est sur la rangée. */
  shown: boolean;
  onScroll: (direction: "left" | "right") => void;
}

/**
 * Zones de défilement d'une rangée, révélées au survol.
 *
 * Le dégradé partait d'un `rgba(0,0,0,0.65)` EN DUR et le chevron d'un
 * `text-white` : en thème clair, une bavure noire sur le fond nacré, surmontée
 * d'un chevron blanc illisible. Les deux suivent désormais la page —
 * `--row-fade-*` (adossé à `--surface-0`) et `text-content-primary`.
 *
 * Montées à la demande, jamais laissées à `opacity: 0` : chaque disque porte un
 * `backdrop-filter`, et il y en a un à deux PAR RANGÉE. L'accueil en aligne une
 * dizaine — autant de couches composées dont l'arrière-plan était recopié et
 * refloué pour des contrôles invisibles. Même constat que pour les pastilles
 * de carte (`components/media/CardMetaOverlay.tsx`).
 */
export function RowScrollControls({ canLeft, canRight, mounted, shown, onScroll }: RowScrollControlsProps) {
  // `pointer-events-none` sur la zone, `auto` sur le seul disque : l'ancienne
  // version était un <button> plein cadre, qui avalait les clics des cartes
  // placées sous le bord de la rangée.
  //
  // `hover-reveal` (theme/reveal.css) remplace `opacity-0 …
  // group-hover/row:opacity-100` : même tempo (200 ms), mais l'entrée passe par
  // `@starting-style` puisqu'il n'existe aucun état précédent au montage.
  const zoneClass =
    "hover-reveal pointer-events-none absolute bottom-12 top-0 z-30 flex w-12 items-center justify-center md:w-16";
  const discClass =
    "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-glass-tint text-content-primary shadow-[var(--elev-2)] ring-1 ring-line-subtle backdrop-blur-md transition-colors hover:ring-[rgba(var(--brand-rgb),0.55)]";
  const zoneStyle = { "--reveal-ms": "200ms" } as React.CSSProperties;

  if (!mounted) return null;

  return (
    <>
      {canLeft && (
        <div
          className={`${zoneClass} left-0`}
          data-shown={shown}
          style={{ ...zoneStyle, background: "var(--row-fade-left)" }}
        >
          <PressableScale
            hoverScale={1.08}
            tapScale={0.92}
            onClick={() => onScroll("left")}
            aria-label="Défiler à gauche"
            className={discClass}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </PressableScale>
        </div>
      )}

      {canRight && (
        <div
          className={`${zoneClass} right-0`}
          data-shown={shown}
          style={{ ...zoneStyle, background: "var(--row-fade-right)" }}
        >
          <PressableScale
            hoverScale={1.08}
            tapScale={0.92}
            onClick={() => onScroll("right")}
            aria-label="Défiler à droite"
            className={discClass}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </PressableScale>
        </div>
      )}
    </>
  );
}
