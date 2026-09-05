import { Alert, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Chip } from "./Chip";
import { STATUS_BADGE, useTicketApi, type Status } from "./ticketTypes";

interface Props {
  ticketId: string;
  status: Status;
}

const STATUSES: Status[] = ["open", "in_progress", "resolved", "closed"];

/**
 * Le changement de statut d'un ticket, pour l'admin, sur mobile : une rangée
 * de chips, le courant en surbrillance. Le serveur ignore un statut identique
 * (rien n'est écrit ni notifié), le détail et la liste se rafraîchissent.
 */
export function TicketStatusPicker({ ticketId, status }: Props) {
  const { t } = useTranslation("tickets");
  const { serverUrl, headers } = useTicketApi();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (next: Status) => {
      const res = await fetch(`${serverUrl}/api/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("status failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: () => Alert.alert(t("changeStatus"), t("statusUpdateFailed")),
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      accessibilityLabel={t("changeStatus")}
    >
      {STATUSES.map((s) => (
        <Chip
          key={s}
          label={t(STATUS_BADGE[s].tKey)}
          active={s === status}
          onPress={() => {
            if (s !== status && !mutation.isPending) mutation.mutate(s);
          }}
        />
      ))}
    </ScrollView>
  );
}
