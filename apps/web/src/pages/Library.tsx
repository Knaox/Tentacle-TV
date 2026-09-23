import { useParams } from "react-router-dom";
import { useLibraries } from "@tentacle-tv/api-client";
import { LibraryGrid } from "../components/LibraryGrid";
import { LibraryHero } from "../components/library/LibraryHero";
import { PageTransition } from "../components/PageTransition";
import { ContentErrorState } from "../components/ContentErrorState";
import { NotFound } from "./NotFound";

export function Library() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const { data: libraries, isError } = useLibraries();
  const library = libraries?.find((l) => l.Id === libraryId);

  if (!libraryId) return null;

  // Sans la liste des bibliothèques, le hero n'a ni nom ni type : la page se
  // rendait sous un titre vide plutôt que de signaler l'échec.
  if (isError && !libraries) {
    return (
      <PageTransition>
        <ContentErrorState />
      </PageTransition>
    );
  }

  // Une bibliothèque absente de la liste n'a pas de page. Le serveur ne rend
  // que les films, les séries et les bibliothèques mixtes (`libraryViews` du
  // backend) : l'adresse d'une bibliothèque de musique ou de livres — comme
  // celle d'une bibliothèque supprimée — ouvrait une page vide, sans titre.
  if (libraries && !library) return <NotFound />;

  return (
    <PageTransition>
      {/* Le hero remonte sous la barre de navigation, qui flotte alors
          transparente au-dessus du backdrop — même montage que l'accueil. */}
      <div className="-mt-[56px] md:-mt-[68px]">
        <LibraryHero
          libraryId={libraryId}
          libraryName={library?.Name ?? ""}
          collectionType={library?.CollectionType}
        />
      </div>

      {/* Chevauchement du bas de bannière, comme les rangées de l'accueil. */}
      <div className="relative z-10 -mt-10 md:-mt-14">
        <LibraryGrid libraryId={libraryId} libraryName={library?.Name ?? ""} />
      </div>
    </PageTransition>
  );
}
