interface UpdateProgressProps {
  /** 0..100. */
  progress: number;
  indeterminate: boolean;
  /** Faux quand l'onglet est caché ou la pop-up hors écran : la bande s'arrête. */
  visible: boolean;
  /** Le nom accessible de la jauge. */
  label: string;
}

/**
 * La JAUGE de la mise à jour, déterminée ou non — ce qui se mesure porte le dégradé de jauge
 * (`.gauge`, `theme/buttons.css`).
 *
 * Le mode INDÉTERMINÉ n'est pas un pis-aller : sous Windows c'est le Microsoft
 * Store qui télécharge et installe, et il n'expose son avancement qu'à un
 * délégué WinRT hors de portée d'un pont FFI. Une bande qui balaie dit la
 * vérité : il se passe quelque chose, on ne sait pas où ça en est.
 *
 * Tout se joue en `transform` : la bande balaie en translation, le remplissage
 * grandit en `scaleX` — jamais `width` ni `background-position`, qui
 * repeindraient la barre à chaque image. Sous mouvement réduit, la bande ne
 * balaie pas ; un remplissage atténué dit « en cours ».
 */
export function UpdateProgress({ progress, indeterminate, visible, label }: UpdateProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
      aria-busy={indeterminate || undefined}
      className="gauge !h-1.5 !rounded-pill"
      data-live={indeterminate ? undefined : "true"}
    >
      {indeterminate ? (
        <>
          <i
            className="w-1/3 motion-reduce:!hidden"
            style={{
              animation: "indeterminateSweep 1.4s cubic-bezier(0.77, 0, 0.175, 1) infinite",
              animationPlayState: visible ? "running" : "paused",
            }}
          />
          <i className="!hidden opacity-50 motion-reduce:!block" />
        </>
      ) : (
        <i style={{ transform: `scaleX(${pct / 100})` }} />
      )}
    </div>
  );
}
