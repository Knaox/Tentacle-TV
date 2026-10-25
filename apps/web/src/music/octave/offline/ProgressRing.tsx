/**
 * Octave — un anneau de progression (préparation sur l'appareil). Sans
 * animation infinie (`CLAUDE.md`, coût GPU) : il avance avec la progression,
 * une transition courte sur le trait, rien d'autre.
 */

export function ProgressRing({ fraction, size = 16, stroke = 2 }: { fraction: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  // Un départ qui se voit : un anneau vide ne dit pas « en cours ».
  const shown = Math.max(0.06, clamped);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - shown)}
        className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}
