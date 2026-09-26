/**
 * La barre de progression de l'app (`ui/ProgressBar`) : 3 px par défaut, piste
 * `border.strong`, remplissage au dégradé de marque violet → rose.
 */
export function ProgressBar({ progress, height = 3, className }: { progress: number; height?: number; className?: string }) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0) return null;
  return (
    <div className={`overflow-hidden ${className ?? ""}`} style={{ height, borderRadius: height / 2, background: "var(--border-strong)" }}>
      <div
        className="h-full"
        style={{
          width: `${clamped * 100}%`,
          borderRadius: height / 2,
          background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
        }}
      />
    </div>
  );
}
