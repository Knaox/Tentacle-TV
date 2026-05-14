/**
 * Types et constantes partagés pour les écrans support/tickets.
 */
import { useMemo } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";

export type Status = "open" | "in_progress" | "resolved" | "closed";
export type Category = "general" | "bug" | "feature" | "account";

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface TicketMessage {
  id: string;
  username: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export const STATUS_BADGE: Record<Status, { tKey: string; variant: "success" | "accent" | "gold" | "muted" }> = {
  open: { tKey: "statusOpen", variant: "success" },
  in_progress: { tKey: "statusInProgress", variant: "accent" },
  resolved: { tKey: "statusResolved", variant: "gold" },
  closed: { tKey: "statusClosed", variant: "muted" },
};

export const CATEGORIES: { value: Category; tKey: string }[] = [
  { value: "general", tKey: "categoryGeneral" },
  { value: "bug", tKey: "categoryBug" },
  { value: "feature", tKey: "categoryFeature" },
  { value: "account", tKey: "categoryAccount" },
];

export const FILTERS = [
  { key: "", tKey: "all" },
  { key: "open", tKey: "open" },
  { key: "in_progress", tKey: "inProgress" },
  { key: "resolved", tKey: "resolved" },
  { key: "closed", tKey: "closed" },
];

export function useTicketApi() {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);
  return { serverUrl, headers };
}
