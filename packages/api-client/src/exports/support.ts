// Support tickets
export {
  useCreateTicket, useMyTickets, useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus, useCloseTicket,
  useDeleteTickets, setTicketsBackendUrl, type SupportTicket, type TicketMessage, type TicketsPage,
} from "../hooks/useTickets";
export {
  TICKET_STATUSES, TICKET_CATEGORIES, TICKET_STATUS_LABEL_KEYS, TICKET_STATUS_FILTER_KEYS,
  TICKET_CATEGORY_LABEL_KEYS, isTicketStatus, type TicketStatus, type TicketCategory,
} from "../utils/ticketMeta";
