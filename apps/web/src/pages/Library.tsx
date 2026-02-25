import { useParams } from "react-router-dom";
import { useLibraries } from "@tentacle/api-client";
import { LibraryGrid } from "../components/LibraryGrid";

export function Library() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const { data: libraries } = useLibraries();
  const name = libraries?.find((l) => l.Id === libraryId)?.Name ?? "";

  if (!libraryId) return null;
  return (
    <div className="pt-8">
      <LibraryGrid libraryId={libraryId} libraryName={name} />
    </div>
  );
}
