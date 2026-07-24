import { useParams } from "react-router-dom";
import { useLibraries } from "@tentacle-tv/api-client";
import { LibraryGrid } from "../components/LibraryGrid";
import { LibraryHero } from "../components/library/LibraryHero";
import { PageTransition } from "../components/PageTransition";

export function Library() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const { data: libraries } = useLibraries();
  const library = libraries?.find((l) => l.Id === libraryId);

  if (!libraryId) return null;
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
