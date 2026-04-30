import { SearchTrigger } from "./search/SearchTrigger";
import { SearchOverlay } from "./search/SearchOverlay";
import { useSearchOverlayState } from "./search/useSearchOverlayState";

/**
 * Public entry point used by `TopNav` / `TopNavMobile` / `MobileTabBar`.
 * Thin wrapper that combines the trigger pill + the full-screen overlay.
 *
 * Why kept as a single export name: many call sites already import
 * `GlobalSearch`. Preserving the name avoids a large fan-out refactor while
 * the implementation underneath swapped from inline dropdown to overlay.
 */
export function GlobalSearch() {
  const { open, show, hide } = useSearchOverlayState();

  return (
    <>
      <SearchTrigger onClick={show} />
      <SearchOverlay open={open} onClose={hide} />
    </>
  );
}
