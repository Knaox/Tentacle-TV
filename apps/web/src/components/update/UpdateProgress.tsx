interface UpdateProgressProps {
  /** 0..100. */
  progress: number;
  indeterminate: boolean;
  /** Faux quand l'onglet est caché ou la pop-up hors écran : la bande s'arrête. */
  visible: boolean;
}

const FILL = "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]";

/**
 * Barre de progression, déterminée ou non.
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
export function UpdateProgress({ progress, indeterminate, visible }: UpdateProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
      aria-busy={indeterminate || undefined}
      className="relative h-2 w-full overflow-hidden rounded-full bg-fill-soft"
    >
      {indeterminate ? (
        <>
          <div
            className={`${FILL} w-1/3 motion-reduce:hidden`}
            style={{
              animation: "indeterminateSweep 1.4s ease-in-out infinite",
              animationPlayState: visible ? "running" : "paused",
            }}
          />
          <div className={`${FILL} hidden w-full opacity-50 motion-reduce:block`} />
        </>
      ) : (
        <div
          className={`${FILL} w-full origin-left`}
          style={{
            transform: `scaleX(${pct / 100})`,
            transition: "transform var(--duration-base) var(--ease-out)",
          }}
        />
      )}
    </div>
  );
}
