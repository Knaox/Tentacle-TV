import { useLocalSearchParams } from "expo-router";
import { PersonScreen } from "@/screens/PersonScreen";

export default function PersonRoute() {
  const { personId, role } = useLocalSearchParams<{ personId: string; role?: string }>();
  return <PersonScreen key={personId} personId={personId} role={typeof role === "string" && role !== "" ? role : null} />;
}
