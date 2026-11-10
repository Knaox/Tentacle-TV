/**
 * Les tickets de l'utilisateur du labo (page Aide, `/support`) : quatre, un par statut, avec
 * leurs fils. Tout `/api/tickets/*` SAUF `/api/tickets/all*` (l'administration, `admin.ts`) :
 * les motifs s'en écartent d'eux-mêmes, quel que soit l'ordre de la table.
 * Formes : `packages/api-client/src/hooks/useTickets.ts` (`SupportTicket`, `TicketsPage`).
 */

import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";
import { LAB_USER } from "./base";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Status = "open" | "in_progress" | "resolved" | "closed";
type Category = "general" | "bug" | "feature" | "account";

interface LabMessage {
  id: string;
  ticketId: string;
  jellyfinUserId: string;
  username: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

interface LabTicket {
  id: string;
  jellyfinUserId: string;
  username: string;
  subject: string;
  category: Category;
  status: Status;
  mediaItemId: string | null;
  mediaItemName: string | null;
  createdAt: string;
  updatedAt: string;
  messages: LabMessage[];
}

const SUPPORT = { jellyfinUserId: "u-noe", username: "Noé" };

/** Un fil : l'auteur du ticket et l'administration, tour à tour. */
function thread(ticketId: string, startedAgo: number, lines: ReadonlyArray<readonly [fromAdmin: boolean, body: string]>): LabMessage[] {
  const step = startedAgo / (lines.length + 1);
  return lines.map(([fromAdmin, body], index) => ({
    id: `${ticketId}-m${index + 1}`,
    ticketId,
    jellyfinUserId: fromAdmin ? SUPPORT.jellyfinUserId : LAB_USER.Id,
    username: fromAdmin ? SUPPORT.username : LAB_USER.Name,
    isAdmin: fromAdmin,
    body,
    createdAt: labAgo(startedAgo - index * step),
  }));
}

function ticket(
  id: string, subject: string, category: Category, status: Status, createdAgo: number, updatedAgo: number,
  media: string | null, lines: ReadonlyArray<readonly [boolean, string]>,
): LabTicket {
  return {
    id, subject, category, status,
    jellyfinUserId: LAB_USER.Id,
    username: LAB_USER.Name,
    mediaItemId: media ? `item-${id}` : null,
    mediaItemName: media,
    createdAt: labAgo(createdAgo),
    updatedAt: labAgo(updatedAgo),
    messages: thread(id, createdAgo, lines),
  };
}

const tickets: LabTicket[] = [
  ticket("tk-sintel", "Sous-titres décalés d'environ deux secondes", "bug", "open", 3 * HOUR, 3 * HOUR, "Sintel", [
    [false, "Depuis hier soir, les sous-titres français de Sintel arrivent deux secondes trop tard, sur la TV comme sur le web."],
  ]),
  ticket("tk-4k", "Une version 4K de Tears of Steel ?", "feature", "in_progress", 4 * DAY, 20 * HOUR, "Tears of Steel", [
    [false, "Le film n'existe qu'en 1080p dans la bibliothèque. Une version 4K HDR serait possible ?"],
    [true, "Bonne idée, je regarde ce qui est disponible et je l'ajoute cette semaine."],
    [false, "Merci ! Pas d'urgence."],
  ]),
  ticket("tk-jumelage", "La TV de la chambre ne se jumelle plus", "general", "resolved", 9 * DAY, 6 * DAY, null, [
    [false, "Le code à quatre caractères est refusé à chaque essai depuis la mise à jour de la TV."],
    [true, "Le serveur avait changé d'adresse : j'ai corrigé le lien public. Vous pouvez réessayer ?"],
    [false, "C'est bon, la TV est de nouveau jumelée."],
    [true, "Parfait, je passe le ticket en résolu."],
  ]),
  ticket("tk-compte", "Changer le nom affiché de mon compte", "account", "closed", 34 * DAY, 30 * DAY, null, [
    [false, "Est-il possible d'afficher « Camille » plutôt que mon identifiant complet ?"],
    [true, "C'est fait, le nouveau nom apparaît à la prochaine connexion."],
  ]),
];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown, fallback: string): string => (typeof value === "string" && value.trim() !== "" ? value : fallback);

/** La ligne d'une liste : le ticket sans son fil, avec le nombre de messages. */
function summary({ messages, ...rest }: LabTicket) {
  return { ...rest, _count: { messages: messages.length } };
}

/** Un ticket que cette table ne connaît pas (ouvert depuis l'administration) : un fil plausible, à son identifiant. */
function foreign(id: string): LabTicket {
  return {
    ...ticket(id, "Le son se coupe par moments", "bug", "open", 2 * DAY, 5 * HOUR, "Big Buck Bunny", [
      [false, "Le son se coupe quelques secondes toutes les dix minutes environ, uniquement sur ce film."],
      [true, "Merci du signalement, je relance l'analyse du fichier."],
    ]),
    jellyfinUserId: "u-lea",
    username: "Léa",
  };
}

function find(id: string): LabTicket {
  const known = tickets.find((entry) => entry.id === id);
  if (known) return known;
  const made = foreign(id);
  tickets.push(made);
  return made;
}

/**
 * Tous les tickets du serveur, pour l'administration (`adminActivity.ts` › `/api/tickets/all`) :
 * ceux du compte du labo, et celui d'un autre compte (Léa) — le même état vivant que la page Aide.
 */
export function labAllTickets() {
  find("tk-son");
  return tickets.map(summary);
}

function message(target: LabTicket, body: string, isAdmin: boolean): LabMessage {
  const made: LabMessage = {
    id: `${target.id}-m${target.messages.length + 1}`,
    ticketId: target.id,
    jellyfinUserId: LAB_USER.Id,
    username: LAB_USER.Name,
    isAdmin,
    body,
    createdAt: labAgo(0),
  };
  target.messages.push(made);
  target.updatedAt = made.createdAt;
  return made;
}

/** `/api/tickets/<id>` et `/api/tickets/<id>/<geste>` — jamais `all` ni `batch`. */
const ONE = "(?!all(?:/|$)|batch$)([^/]+)";
const idIn = (url: URL): string => decodeURIComponent(url.pathname.split("/")[3] ?? "");
const STATUSES: readonly Status[] = ["open", "in_progress", "resolved", "closed"];

export const ticketRoutes: readonly LabRoute[] = [
  {
    path: /^\/api\/tickets\/?$/,
    reply: ({ url }) => {
      const status = url.searchParams.get("status");
      const mine = tickets.filter((entry) => entry.jellyfinUserId === LAB_USER.Id && (!status || entry.status === status));
      const limit = Number(url.searchParams.get("limit")) || 20;
      return { results: mine.slice(0, limit).map(summary), total: mine.length, page: 1, totalPages: Math.max(1, Math.ceil(mine.length / limit)) };
    },
  },
  {
    method: "POST",
    path: /^\/api\/tickets\/?$/,
    reply: ({ body }) => {
      const input = isRecord(body) ? body : {};
      const media = typeof input.mediaItemName === "string" ? input.mediaItemName : null;
      const made = ticket(`tk-${Date.now()}`, text(input.subject, "Nouveau ticket"), "general", "open", 0, 0, media, [
        [false, text(input.body, "…")],
      ]);
      const category = input.category;
      if (category === "bug" || category === "feature" || category === "account") made.category = category;
      tickets.unshift(made);
      return made;
    },
  },
  { path: new RegExp(`^/api/tickets/${ONE}$`), reply: ({ url }) => find(idIn(url)) },
  {
    method: "POST",
    path: new RegExp(`^/api/tickets/${ONE}/reply$`),
    reply: ({ url, body }) => message(find(idIn(url)), text(isRecord(body) ? body.body : null, "…"), false),
  },
  {
    method: "POST",
    path: new RegExp(`^/api/tickets/${ONE}/close$`),
    reply: ({ url, body }) => {
      const target = find(idIn(url));
      message(target, text(isRecord(body) ? body.reason : null, "Fermé par son auteur."), false);
      target.status = "closed";
      return target;
    },
  },
  {
    method: "PATCH",
    path: new RegExp(`^/api/tickets/${ONE}/status$`),
    reply: ({ url, body }) => {
      const target = find(idIn(url));
      const next = isRecord(body) ? STATUSES.find((status) => status === body.status) : undefined;
      if (next) target.status = next;
      target.updatedAt = labAgo(0);
      return target;
    },
  },
  {
    method: "DELETE",
    path: "/api/tickets/batch",
    reply: ({ body }) => {
      const ids = isRecord(body) && Array.isArray(body.ids) ? body.ids : [];
      let deleted = 0;
      for (const id of ids) {
        const index = tickets.findIndex((entry) => entry.id === id);
        if (index >= 0) tickets.splice(index, 1);
        deleted += 1;
      }
      return { deleted };
    },
  },
  {
    method: "DELETE",
    path: new RegExp(`^/api/tickets/${ONE}$`),
    reply: ({ url }) => {
      const index = tickets.findIndex((entry) => entry.id === idIn(url));
      if (index >= 0) tickets.splice(index, 1);
      return { deleted: 1 };
    },
  },
];
