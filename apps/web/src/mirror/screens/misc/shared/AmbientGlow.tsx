import { useChromeInsets } from "../../../useMirrorLayout";

/**
 * L'orbe violet de `SubtleBackground ambient` : un dégradé de 320 de haut,
 * violet 18 % → 4 % (à 30 %) → transparent (à 70 %). Dans la coquille, l'écran
 * commence sous l'en-tête (ou la zone sûre d'un écran empilé) : l'orbe remonte
 * d'autant pour partir du haut de l'écran comme dans l'app (`underHeader`).
 * Statique : rien à repeindre.
 */
export function AmbientGlow({ underHeader = true }: { underHeader?: boolean }) {
  const { top } = useChromeInsets();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0"
      style={{
        top: underHeader ? `calc(-1 * ${top})` : 0,
        height: 320,
        background:
          "linear-gradient(180deg, rgba(var(--brand-rgb), 0.18) 0%, rgba(var(--brand-rgb), 0.04) 30%, transparent 70%)",
      }}
    />
  );
}
