import type { SharedListItem } from "@tentacle-tv/api-client";

interface Props {
  items: SharedListItem[];
  authed: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
}

/** Image d'affiche via le proxy public (visible aussi pour les anonymes). */
function posterUrl(item: SharedListItem): string {
  const tag = item.ImageTags?.Primary;
  const params = `fillHeight=450&quality=90${tag ? `&tag=${tag}` : ""}`;
  return `/api/jellyfin/Items/${item.Id}/Images/Primary?${params}`;
}

/** Grille lecture seule d'une liste partagée. Sélectionnable si connecté. */
export function SharedListGrid({ items, authed, selected, onToggle }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
      {items.map((item) => {
        const isSel = selected.has(item.Id);
        return (
          <button
            key={item.Id}
            type="button"
            disabled={!authed}
            onClick={() => authed && onToggle(item.Id)}
            className={`group relative overflow-hidden rounded-xl bg-tentacle-surface text-left transition-transform ${
              authed ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"
            }`}
          >
            <div className="relative aspect-[2/3]">
              <img
                src={posterUrl(item)}
                alt={item.Name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {authed && (
                <div
                  className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                    isSel
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-white/60 bg-black/40 text-transparent"
                  }`}
                  aria-hidden
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="line-clamp-1 text-sm font-medium text-white">{item.Name}</p>
              {item.ProductionYear && <p className="text-xs text-white/45">{item.ProductionYear}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
