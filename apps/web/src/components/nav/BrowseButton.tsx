import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLibraries } from "@tentacle-tv/api-client";
import { PlusMenu } from "../PlusMenu";
import { usePinnedNav } from "../../hooks/usePinnedNav";

/**
 * Desktop entry-point for the pinning panel. Renders a single button in the
 * TopNav that opens the existing PlusMenu as a dropdown anchored under it.
 *
 * When the user has nothing pinned (first run), a subtle pulse dot draws the
 * eye to this button — without altering the visual rhythm of the nav.
 */
export function BrowseButton() {
  const { t } = useTranslation("nav");
  const { data: libraries } = useLibraries();
  const pinned = usePinnedNav();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Nothing pinned at all → highlight the entry point so new users find it.
  const hasNothingPinned =
    !pinned.watchlist &&
    !pinned.favorites &&
    (!libraries || libraries.every((l) => !pinned.isLibraryPinned(l.Id)));

  // Keep anchorRect in sync while open (handles resize / scroll).
  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      if (buttonRef.current) {
        setAnchorRect(buttonRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open]);

  const handleToggle = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("libraries")}
        className={`group relative flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
          open
            ? "bg-white/10 text-white"
            : "text-white/70 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <GridIcon />
        <span className="hidden lg:inline">{t("libraries")}</span>
        <ChevronIcon open={open} />

        {/* Onboarding hint: pulse dot when user has zero pins */}
        {hasNothingPinned && !open && (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-[rgba(var(--brand-rgb),0.7)]" />
            <span className="absolute inset-0 rounded-full bg-[var(--brand)] shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
          </span>
        )}
      </button>

      {open && (
        <PlusMenu
          isMobile={false}
          placement="dropdown"
          anchorRect={anchorRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function GridIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
