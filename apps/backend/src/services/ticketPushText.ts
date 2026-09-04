import { parseTicketNotifBody } from "./ticketNotifTypes";

/**
 * Texte POUSSÉ sur le téléphone pour une notification de ticket.
 *
 * La base reste brute (sujet, statut, « auteur puis extrait ») et les cloches
 * traduisent elles-mêmes ; mais un push s'affiche tel quel, et le serveur n'a
 * pas la locale de l'appareil. On compose donc ici, dans la langue d'interface
 * que l'utilisateur a choisie côté serveur (`server_config` → `user_lang_<id>`),
 * français par défaut — comme libraryAddedNotifier compose ses annonces.
 */

export type PushLang = "fr" | "en";

const STATUS_LABELS: Record<PushLang, Record<string, string>> = {
  fr: { open: "Ouvert", in_progress: "En cours", resolved: "Résolu", closed: "Fermé" },
  en: { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" },
};

export function normalizePushLang(raw: string | null | undefined): PushLang {
  return raw?.trim().toLowerCase().startsWith("en") ? "en" : "fr";
}

export function ticketPushText(
  n: { type: string; title: string; body: string | null },
  lang: PushLang,
): { title: string; body: string } {
  const subject = n.title;
  const en = lang === "en";
  switch (n.type) {
    case "ticket_new": {
      const { username } = parseTicketNotifBody(n.body);
      const title = en
        ? username ? `New ticket from ${username}` : "New ticket"
        : username ? `Nouveau ticket de ${username}` : "Nouveau ticket";
      return { title, body: subject };
    }
    case "ticket_user_reply": {
      const { username } = parseTicketNotifBody(n.body);
      const title = en
        ? username ? `${username} replied` : "New reply"
        : username ? `${username} a répondu` : "Nouvelle réponse";
      return { title, body: subject };
    }
    case "ticket_status": {
      const raw = n.body ?? "";
      const status = STATUS_LABELS[lang][raw] ?? raw;
      return en
        ? { title: `Ticket "${subject}"`, body: `Status: ${status}` }
        : { title: `Ticket « ${subject} »`, body: `Statut : ${status}` };
    }
    default:
      return en
        ? { title: `Reply on "${subject}"`, body: n.body ?? "" }
        : { title: `Réponse sur « ${subject} »`, body: n.body ?? "" };
  }
}
