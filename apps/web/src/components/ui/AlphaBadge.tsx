/**
 * Pastille « ALPHA » — marque une fonctionnalité expérimentale (même style que
 * le badge de préversion de la page À propos).
 */
export function AlphaBadge({ label = "ALPHA" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.5)] backdrop-blur-md"
      style={{
        background: "linear-gradient(180deg, rgba(var(--brand-rgb), 0.32) 0%, rgba(var(--brand-rgb), 0.18) 100%)",
        boxShadow: "0 2px 10px rgba(var(--brand-rgb), 0.35)",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      }}
    >
      {label}
    </span>
  );
}
