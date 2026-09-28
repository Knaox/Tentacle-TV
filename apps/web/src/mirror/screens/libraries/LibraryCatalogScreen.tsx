import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { useBackOrHome } from "../../catalog";
import { LibraryCatalogView } from "./LibraryCatalogView";
import "../../mirror.css";

/** La zone sûre d'un écran empilé (`MirrorLayout`) : l'ambiance remonte d'autant. */
const STACKED_TOP = "max(env(safe-area-inset-top, 0px), 24px)";

/**
 * Une bibliothèque ouverte depuis ailleurs (`screens/LibraryCatalogScreen`
 * de l'app, route `library/[libraryId]`) : la vue de l'onglet — héros,
 * recherche, barre rapide, grille —, sans la capsule, avec un retour flottant
 * (rond de 40, aplat translucide et liseré, sans flou : la grille défile
 * dessous) qui reste à portée pendant tout le défilement.
 */
export function LibraryCatalogScreen({ libraryId }: { libraryId: string }) {
  const { t } = useTranslation("common");
  const back = useBackOrHome();
  const { data: libraries } = useLibraries();
  const library = useMemo<LibraryView>(
    () => libraries?.find((lib) => lib.Id === libraryId) ?? ({ Id: libraryId, Name: "" } as LibraryView),
    [libraries, libraryId],
  );

  return (
    <div className="relative">
      <LibraryCatalogView library={library} heroTopInset={STACKED_TOP} />
      <button
        type="button"
        onClick={back}
        aria-label={t("back")}
        className="fixed left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-content-primary transition-transform duration-100 active:scale-95 active:opacity-80"
        style={{
          top: `calc(${STACKED_TOP} + 4px)`,
          background: "color-mix(in srgb, var(--surface-0) 72%, transparent)",
        }}
      >
        <ChevronLeft size={24} aria-hidden />
      </button>
    </div>
  );
}
