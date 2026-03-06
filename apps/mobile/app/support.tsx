import { useLocalSearchParams } from "expo-router";
import { SupportScreen } from "@/screens/SupportScreen";

export default function SupportRoute() {
  const { ticketId } = useLocalSearchParams<{ ticketId?: string }>();
  return <SupportScreen initialTicketId={ticketId} />;
}
