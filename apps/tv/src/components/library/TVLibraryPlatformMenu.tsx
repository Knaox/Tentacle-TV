import { TVLibraryFilterMenu, TVCheckRow, type MenuAnchor } from "./TVLibraryFilterMenu";
import { PLATFORMS } from "../../hooks/usePlatformFilter";

/** Le menu des plateformes de streaming — 11 fournisseurs TMDB, multi-choix,
 *  comme la LG. Le filtrage lui-même est `usePlatformFilter`. */
export function TVPlatformMenu({
  anchor,
  selectedIds,
  onToggle,
}: {
  anchor: MenuAnchor;
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const firstChecked = PLATFORMS.find((p) => selectedIds.includes(p.id))?.id ?? PLATFORMS[0].id;

  return (
    <TVLibraryFilterMenu anchor={anchor}>
      {PLATFORMS.map((platform) => (
        <TVCheckRow
          key={platform.id}
          label={platform.name}
          checked={selectedIds.includes(platform.id)}
          preferred={platform.id === firstChecked}
          onPress={() => onToggle(platform.id)}
        />
      ))}
    </TVLibraryFilterMenu>
  );
}
