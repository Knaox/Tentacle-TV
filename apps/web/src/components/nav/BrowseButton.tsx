import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PlusMenu } from "../PlusMenu";

/**
 * Desktop entry-point for the pinning panel. Renders a single button in the
 * TopNav that opens the existing PlusMenu as a dropdown anchored under it.
 */
export function BrowseButton() {
  const { t } = useTranslation("nav");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

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
            ? "bg-fill-soft text-content-primary"
            : "text-content-secondary hover:bg-fill-subtle hover:text-content-primary"
        }`}
      >
        <GridIcon />
        <span className="hidden lg:inline">{t("libraries")}</span>
        <ChevronIcon open={open} />

        {/* Il n'y a PLUS de pastille d'onboarding ici, et la raison est
            entièrement énergétique.
            Elle battait en boucle (`animate-ping`) tant qu'aucune bibliothèque
            n'était épinglée — c'est-à-dire, pour un nouvel utilisateur,
            indéfiniment — dans une barre affichée sur TOUTES les pages. Or il
            suffit d'une seule animation infinie pour que le compositeur ne se
            rendorme jamais et que le GPU ne redescende pas en veille : à elle
            seule, elle tenait le plancher de consommation de l'application.
            Le bouton reste parfaitement trouvable, il est libellé. */}
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
