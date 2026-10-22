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

  it("la Famille dit le nom de l'autre, jamais une phrase stockée", () => {
    expect(formatNotifTitle({ type: "family_invite", title: "Damien", body: null }, t))
      .toBe('family:notifications.family_invite{"name":"Damien"}');
    expect(formatNotifTitle({ type: "family_invite_declined", title: "Léa", body: null }, t))
      .toBe('family:notifications.family_invite_declined{"name":"Léa"}');
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

describe("formatNotifTitle — ancienne phrase de statut, lecture linéaire", () => {
  const LEGACY_STATUS = /^Ticket\s+"(.+?)"\s+—\s+(.+)$/;
  const STATUSES: Record<string, string> = { Ouvert: "open", "En cours": "in_progress", Résolu: "resolved", Fermé: "closed" };

  it("rend ce que rendait l'ancienne regex", () => {
    const alphabet = ["Ticket", " ", "  ", "\n", '"', "—", "Résolu", "En cours", "a", "x"];
    let seed = 3;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 5000; i++) {
      const parts = Array.from({ length: Math.floor(next() * 10) }, () => alphabet[Math.floor(next() * alphabet.length)]);
      const title = `Ticket${next() < 0.2 ? "\n" : " "}"${parts.join("")}`;
      const legacy = LEGACY_STATUS.exec(title);
      const key = legacy ? STATUSES[legacy[2]] : undefined;
      const expected = legacy && key ? formatNotifTitle({ type: "ticket_status", title: "S", body: key }, t).replace('"S"', JSON.stringify(legacy[1])) : title;
      expect(formatNotifTitle({ type: "ticket_status", title, body: null }, t)).toBe(expected);
    }
  });

  it("lit un sujet hostile en un instant (CodeQL polynomial-redos)", () => {
    const started = performance.now();
    formatNotifTitle({ type: "ticket_status", title: `Ticket "a" — ${" ".repeat(60_000)}\n`, body: null }, t);
    formatNotifTitle({ type: "ticket_status", title: `Ticket "a${'"  —  '.repeat(10_000)}\n`, body: null }, t);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
