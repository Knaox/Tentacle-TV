import { describe, expect, it } from "vitest";
import { normalizePushLang, ticketPushText } from "./ticketPushText";
import { composeTicketNotifBody, parseTicketNotifBody } from "./ticketNotifTypes";

describe("corps « auteur puis extrait »", () => {
  it("se compose et se relit, retour à la ligne de l'auteur neutralisé", () => {
    const body = composeTicketNotifBody("da\nmien", "Le lecteur\nplante");
    expect(parseTicketNotifBody(body)).toEqual({ username: "da mien", excerpt: "Le lecteur\nplante" });
  });

  it("un corps sans auteur (ancienne ligne) reste lisible", () => {
    expect(parseTicketNotifBody("juste un extrait")).toEqual({ username: "", excerpt: "juste un extrait" });
    expect(parseTicketNotifBody(null)).toEqual({ username: "", excerpt: "" });
  });
});

describe("texte poussé", () => {
  const subject = "Sous-titres décalés";

  it("nouveau ticket et réponse d'utilisateur nomment l'auteur, dans les deux langues", () => {
    const body = composeTicketNotifBody("alice", "Le lecteur plante");
    expect(ticketPushText({ type: "ticket_new", title: subject, body }, "fr"))
      .toEqual({ title: "Nouveau ticket de alice", body: subject });
    expect(ticketPushText({ type: "ticket_new", title: subject, body }, "en"))
      .toEqual({ title: "New ticket from alice", body: subject });
    expect(ticketPushText({ type: "ticket_user_reply", title: subject, body }, "fr"))
      .toEqual({ title: "alice a répondu", body: subject });
    expect(ticketPushText({ type: "ticket_user_reply", title: subject, body }, "en"))
      .toEqual({ title: "alice replied", body: subject });
  });

  it("la fermeture par l'auteur nomme l'auteur, le motif reste dans le fil", () => {
    const body = composeTicketNotifBody("alice", "Résolu de mon côté");
    expect(ticketPushText({ type: "ticket_user_closed", title: subject, body }, "fr"))
      .toEqual({ title: "alice a fermé le ticket", body: subject });
    expect(ticketPushText({ type: "ticket_user_closed", title: subject, body }, "en"))
      .toEqual({ title: "alice closed the ticket", body: subject });
  });

  it("sans auteur, un titre générique", () => {
    expect(ticketPushText({ type: "ticket_new", title: subject, body: null }, "fr").title).toBe("Nouveau ticket");
    expect(ticketPushText({ type: "ticket_user_reply", title: subject, body: null }, "en").title).toBe("New reply");
  });

  it("le statut brut devient un libellé, inconnu rendu tel quel", () => {
    expect(ticketPushText({ type: "ticket_status", title: subject, body: "in_progress" }, "fr"))
      .toEqual({ title: `Ticket « ${subject} »`, body: "Statut : En cours" });
    expect(ticketPushText({ type: "ticket_status", title: subject, body: "resolved" }, "en"))
      .toEqual({ title: `Ticket "${subject}"`, body: "Status: Resolved" });
    expect(ticketPushText({ type: "ticket_status", title: subject, body: "weird" }, "fr").body).toBe("Statut : weird");
  });

  it("la réponse d'un admin porte l'extrait en corps", () => {
    expect(ticketPushText({ type: "ticket_reply", title: subject, body: "On regarde ça" }, "fr"))
      .toEqual({ title: `Réponse sur « ${subject} »`, body: "On regarde ça" });
    expect(ticketPushText({ type: "ticket_reply", title: subject, body: null }, "en"))
      .toEqual({ title: `Reply on "${subject}"`, body: "" });
  });

  it("la langue : « en » et ses variantes, tout le reste est du français", () => {
    expect(normalizePushLang("en")).toBe("en");
    expect(normalizePushLang("EN-US")).toBe("en");
    expect(normalizePushLang("fr")).toBe("fr");
    expect(normalizePushLang(null)).toBe("fr");
    expect(normalizePushLang("de")).toBe("fr");
  });
});
