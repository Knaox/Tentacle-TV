import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Folder } from "lucide-react";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { GridSkeleton } from "../../catalog";
import { LibraryCapsule } from "./LibraryCapsule";
import { LibraryCatalogView } from "./LibraryCatalogView";
import { LIBRARY_HERO_HEIGHT, collectionIcon } from "./LibraryHero";
import "../../mirror.css";

/** La bibliothèque choisie survit au changement d'onglet (le temps de la session). */
let lastLibraryId: string | null = null;

/**
 * L'onglet Bibliothèque (`screens/LibrariesScreen` de l'app) : on arrive DANS
 * la dernière bibliothèque ouverte, la capsule passe de Films à Séries d'un
 * geste, et l'ambiance change avec elle. Tout défile d'un seul tenant —
 * héros, capsule, recherche, filtres, grille — et replie le chrome.
 *
 * La bibliothèque choisie vit aussi dans l'adresse (`?lib=`) : un retour
 * depuis une fiche la retrouve, un lien la partage.
 */
export function LibrariesScreen() {
  const { t } = useTranslation("common");
  const { data, isLoading } = useLibraries();
  const [params, setParams] = useSearchParams();
  const libraries = useMemo(() => data ?? [], [data]);
  const wanted = params.get("lib") ?? lastLibraryId;
  const current = libraries.find((lib) => lib.Id === wanted) ?? libraries[0] ?? null;

  const select = useCallback((id: string) => {
    lastLibraryId = id;
    // La nouvelle bibliothèque s'ouvre en haut : garder la position d'une autre grille n'aurait aucun sens.
    window.scrollTo({ top: 0 });
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("lib", id);
      return next;
    }, { replace: true });
  }, [setParams]);

  if (isLoading) return <LibrariesSkeleton />;
  if (!current) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Folder size={48} className="text-brand-light opacity-60" aria-hidden />
        <div className="flex max-w-[300px] flex-col gap-1 text-center">
          <p className="text-[15px] font-semibold text-content-primary">{t("library:noLibraries")}</p>
          <p className="text-[13px] text-content-tertiary">{t("library:noLibrariesHint")}</p>
        </div>
      </div>
    );
  }
  return <LibraryTab libraries={libraries} current={current} onSelect={select} />;
}

function LibraryTab({ libraries, current, onSelect }: {
  libraries: LibraryView[];
  current: LibraryView;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const capsuleItems = useMemo(
    () => libraries.map((lib) => ({ id: lib.Id, label: lib.Name, icon: collectionIcon(lib.CollectionType) })),
    [libraries],
  );
  return (
    <LibraryCatalogView
      library={current}
      capsule={<LibraryCapsule items={capsuleItems} selected={current.Id} onSelect={onSelect} label={t("librariesTitle")} />}
    />
  );
}

/** Le squelette de l'onglet : titre 180×40, capsule 48, deux rangées d'affiches. */
function LibrariesSkeleton() {
  return (
    <div aria-hidden style={{ paddingTop: LIBRARY_HERO_HEIGHT - 80 }}>
      <div className="mx-4 mb-4 h-10 w-[180px] rounded-lg bg-fill-subtle" />
      <div className="mx-4 mb-4 h-12 max-w-[560px] rounded-full bg-fill-subtle" />
      <GridSkeleton rows={3} captions />
    </div>
  );
}
