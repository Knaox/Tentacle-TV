import { memo } from "react";
import { Check } from "lucide-react";
import { useJellyfinClient, type ColdStartTitle } from "@tentacle-tv/api-client";
import { Pressable } from "../../ui/Pressable";

/**
 * `ColdStartCard` de l'app : toute l'affiche est la cible. Sélection = anneau
 * de marque de 2, voile dégradé et coche ronde de 28 au dégradé violet → rose
 * — opacité et échelle seulement (200 ms), ni flou ni ombre animée.
 */
export const ColdStartCard = memo(function ColdStartCard({ title, selected, width, onToggle }: {
  title: ColdStartTitle;
  selected: boolean;
  width: number;
  onToggle: (title: ColdStartTitle, selected: boolean) => void;
}) {
  const client = useJellyfinClient();
  const poster = client.getImageUrl(title.jellyfinItemId, "Primary", { height: 360, quality: 85 });
  const fade = "opacity 200ms ease-out, transform 200ms ease-out";
  return (
    <Pressable
      onPress={() => onToggle(title, selected)}
      style={{ width }}
      role="checkbox"
      aria-checked={selected}
      aria-label={title.year ? `${title.name} (${title.year})` : title.name}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl border-2 bg-surface-2"
        style={{ borderColor: selected ? "var(--brand)" : "transparent" }}
      >
        <img src={poster} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, transparent, rgba(var(--scrim-media-rgb), 0.12) 50%, rgba(var(--scrim-media-rgb), 0.7))",
            opacity: selected ? 1 : 0,
            transition: fade,
          }}
        />
        <span
          className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-cta-brand-fg"
          style={{
            background: "linear-gradient(135deg, var(--brand), var(--brand-accent))",
            opacity: selected ? 1 : 0,
            transform: `scale(${selected ? 1 : 0.5})`,
            transition: fade,
          }}
        >
          <Check size={15} aria-hidden />
        </span>
      </div>
      <p className="mt-2 truncate text-[13px] font-semibold text-content-primary">{title.name}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium text-content-tertiary">{title.year ?? ""}</p>
    </Pressable>
  );
});
