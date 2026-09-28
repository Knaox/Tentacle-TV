import { PlayIcon } from "../../../components/media/MediaDetailIcons";

const R = 11;
const C = 2 * Math.PI * R;

interface FauxPlayButtonProps {
  label: string;
  remaining: string | null;
  /** 0..1 : l'anneau d'avancement autour de l'icône ; `null`, pas d'anneau. */
  progress: number | null;
}

/**
 * L'action principale de la fiche (`DetailPlayButton`) : seule en couleur, au
 * dégradé de marque, avec l'anneau d'avancement autour de l'icône et le temps
 * restant en clair sous « Reprendre ».
 */
export function FauxPlayButton({ label, remaining, progress }: FauxPlayButtonProps) {
  return (
    <span
      className="relative flex h-10 items-center gap-2 overflow-hidden rounded-full pl-2.5 pr-5 text-cta-brand-fg ring-1 ring-white/20"
      style={{
        background: "linear-gradient(120deg, var(--brand) 0%, var(--brand-accent) 100%)",
        boxShadow: "0 8px 24px rgba(var(--brand-rgb), 0.42)",
      }}
    >
      <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
        {progress !== null && (
          <svg className="absolute inset-0 h-6 w-6 -rotate-90" viewBox="0 0 26 26">
            <circle cx="13" cy="13" r={R} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
            <circle cx="13" cy="13" r={R} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
          </svg>
        )}
        <span className="relative ml-px flex h-3 w-3 items-center justify-center [&>svg]:h-3 [&>svg]:w-3"><PlayIcon /></span>
      </span>
      <span className="relative flex flex-col leading-tight">
        <span className="whitespace-nowrap text-[12px] font-bold">{label}</span>
        {remaining && <span className="whitespace-nowrap text-[9px] font-medium opacity-85">{remaining}</span>}
      </span>
    </span>
  );
}
