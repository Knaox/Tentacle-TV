/**
 * Les mots de la page de partage AUTONOME du serveur (FR/EN) — repris de
 * l'espace i18n `share` des clients ; le backend ne dépend pas de
 * `@tentacle-tv/shared`. La langue se choisit comme pour la page
 * d'invitation (`invitePageLang`).
 */
export type SharePageLang = "fr" | "en";

export interface SharePageText {
  otherLang: string;
  /** `{name}` : le propriétaire du lien. */
  watchlistTitle: string;
  likesTitle: string;
  watchlistLead: string;
  likesLead: string;
  countOne: string;
  /** `{count}`. */
  countOther: string;
  movie: string;
  series: string;
  emptyTitle: string;
  emptyLead: string;
  notFoundTitle: string;
  notFoundLead: string;
  unavailableTitle: string;
  unavailableLead: string;
  errorTitle: string;
  errorLead: string;
  statsTitle: string;
  statsLead: string;
  retry: string;
  getApp: string;
  getAppLink: string;
}

export const SHARE_PAGE_TEXT: Record<SharePageLang, SharePageText> = {
  fr: {
    otherLang: "English",
    watchlistTitle: "La liste de {name}",
    likesTitle: "Les favoris de {name}",
    watchlistLead: "Les films et les séries que {name} garde pour plus tard.",
    likesLead: "Les films et les séries que {name} a aimés.",
    countOne: "1 titre",
    countOther: "{count} titres",
    movie: "Film",
    series: "Série",
    emptyTitle: "Rien pour l'instant",
    emptyLead: "{name} n'a encore rien mis dans cette liste.",
    notFoundTitle: "Lien introuvable",
    notFoundLead: "Ce lien a été révoqué par son auteur, ou il a été mal copié. Demandez-lui un nouveau lien.",
    unavailableTitle: "Lien indisponible",
    unavailableLead: "Ce partage n'est pas ouvert pour le moment. Réessayez plus tard, ou demandez à son auteur.",
    errorTitle: "Impossible d'ouvrir ce partage",
    errorLead: "Le serveur ne répond pas pour le moment. Réessayez dans un instant.",
    statsTitle: "Partage de statistiques",
    statsLead: "Ce partage s'ouvre dans l'interface web du serveur, qui n'est pas ouverte ici.",
    retry: "Réessayer",
    getApp: "Partagé avec Tentacle, un client pour Jellyfin.",
    getAppLink: "Découvrir Tentacle",
  },
  en: {
    otherLang: "Français",
    watchlistTitle: "{name}'s list",
    likesTitle: "{name}'s favorites",
    watchlistLead: "The movies and shows {name} is saving for later.",
    likesLead: "The movies and shows {name} liked.",
    countOne: "1 title",
    countOther: "{count} titles",
    movie: "Movie",
    series: "Show",
    emptyTitle: "Nothing yet",
    emptyLead: "{name} hasn't put anything in this list yet.",
    notFoundTitle: "Link not found",
    notFoundLead: "This link was revoked by its author, or it was copied wrong. Ask them for a new link.",
    unavailableTitle: "Link unavailable",
    unavailableLead: "This share isn't open right now. Try again later, or ask its author.",
    errorTitle: "Can't open this share",
    errorLead: "The server isn't answering right now. Try again in a moment.",
    statsTitle: "Shared statistics",
    statsLead: "This share opens in the server's web interface, which isn't open here.",
    retry: "Try again",
    getApp: "Shared with Tentacle, a client for Jellyfin.",
    getAppLink: "Discover Tentacle",
  },
};

/** « {name} » et « {count} » remplacés ; le texte reste à échapper. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
