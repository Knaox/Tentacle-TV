/**
 * L'`ActivityIndicator` de l'app : un anneau qui tourne tant que la requête
 * court — monté seulement pendant le chargement (l'animation infinie meurt
 * avec lui).
 */
export function Spinner({ size = 20, color = "var(--brand)", className }: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      role="progressbar"
      aria-busy="true"
      className={`inline-block animate-spin rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 10))}px solid ${color}`,
        borderTopColor: "transparent",
      }}
    />
  );
}
