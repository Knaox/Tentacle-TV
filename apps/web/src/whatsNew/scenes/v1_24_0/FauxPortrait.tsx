import { initials } from "@tentacle-tv/shared";

/** Le portrait 2:3 d'une personne (`PersonPortrait`) : sa photo, ou ses initiales sur le dégradé de marque. */
export function FauxPortrait({ name, url, className = "" }: { name: string; url: string | null; className?: string }) {
  return (
    <div className={`relative aspect-[2/3] overflow-hidden bg-surface-2 ${className}`}>
      {url ? (
        <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/85"
          style={{ background: "linear-gradient(160deg, rgba(var(--brand-rgb), 0.45) 0%, var(--fill-strong) 100%)" }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}
