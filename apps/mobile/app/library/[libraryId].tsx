import { useLocalSearchParams } from "expo-router";
import { LibraryCatalogScreen } from "@/screens/LibraryCatalogScreen";

export default function LibraryRoute() {
  const { libraryId, libraryName } = useLocalSearchParams<{ libraryId: string; libraryName?: string }>();
  return <LibraryCatalogScreen libraryId={libraryId!} libraryName={libraryName} />;
}
