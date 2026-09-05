import { describe, expect, it } from "vitest";
import { formatNotifTitle, notifBodyText, parseTicketNotifBody } from "./notificationText";

// Un `t` transparent : la clé et ses paramètres, pour vérifier ce qu'on demande.
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}${JSON.stringify(options)}` : key;

describe("parseTicketNotifBody", () => {
  it("sépare l'auteur de l'extrait, et tolère un corps sans auteur", () => {
    expect(parseTicketNotifBody("alice\nLe lecteur\nplante")).toEqual({ username: "alice", excerpt: "Le lecteur\nplante" });
    expect(parseTicketNotifBody("juste un extrait")).toEqual({ username: "", excerpt: "juste un extrait" });
    expect(parseTicketNotifBody(null)).toEqual({ username: "", excerpt: "" });
  });
});

describe("formatNotifTitle", () => {
  it("les types admin nomment l'auteur et le sujet", () => {
    expect(formatNotifTitle({ type: "ticket_new", title: "Sujet", body: "alice\nextrait" }, t))
      .toBe('notifications:ticketNewTitle{"username":"alice","subject":"Sujet"}');
    expect(formatNotifTitle({ type: "ticket_user_reply", title: "Sujet", body: "bob\nextrait" }, t))
      .toBe('notifications:ticketUserReplyTitle{"username":"bob","subject":"Sujet"}');
    expect(formatNotifTitle({ type: "ticket_user_closed", title: "Sujet", body: "bob\nmotif" }, t))
      .toBe('notifications:ticketUserClosedTitle{"username":"bob","subject":"Sujet"}');
    expect(notifBodyText({ type: "ticket_user_closed", body: "bob\nmotif" })).toBe("motif");
  });

  it("le statut brut est traduit, une ancienne phrase française est relue", () => {
    expect(formatNotifTitle({ type: "ticket_status", title: "Sujet", body: "in_progress" }, t))
      .toBe('notifications:ticketStatusTitle{"subject":"Sujet","status":"tickets:statusInProgress"}');
    expect(formatNotifTitle({ type: "ticket_status", title: 'Ticket "Vieux" — Résolu', body: null }, t))
      .toBe('notifications:ticketStatusTitle{"subject":"Vieux","status":"tickets:statusResolved"}');
    expect(formatNotifTitle({ type: "ticket_status", title: "Illisible", body: "weird" }, t)).toBe("Illisible");
  });

  it("la réponse d'un admin, ancienne ou nouvelle forme", () => {
    expect(formatNotifTitle({ type: "ticket_reply", title: "Sujet", body: "x" }, t))
      .toBe('notifications:ticketReplyTitle{"subject":"Sujet"}');
    expect(formatNotifTitle({ type: "ticket_reply", title: 'Réponse sur "Vieux"', body: "x" }, t))
      .toBe('notifications:ticketReplyTitle{"subject":"Vieux"}');
  });

  it("un type inconnu garde son titre", () => {
    expect(formatNotifTitle({ type: "request_status", title: "Tel quel", body: null }, t)).toBe("Tel quel");
  });
});

describe("notifBodyText", () => {
  it("rien pour un statut, l'extrait seul pour les types admin, le corps sinon", () => {
    expect(notifBodyText({ type: "ticket_status", body: "open" })).toBeNull();
    expect(notifBodyText({ type: "ticket_new", body: "alice\nLe lecteur plante" })).toBe("Le lecteur plante");
    expect(notifBodyText({ type: "ticket_user_reply", body: "alice\n" })).toBeNull();
    expect(notifBodyText({ type: "ticket_reply", body: "On regarde" })).toBe("On regarde");
    expect(notifBodyText({ type: "ticket_reply", body: null })).toBeNull();
  });
});
