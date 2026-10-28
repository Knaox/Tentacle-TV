/**
 * Les mots de la page d'un lien de playlist partagée (`sharePage.ts`), FR/EN. Le backend ne dépend pas de
 * `@tentacle-tv/shared` ni de ses traductions ; la langue se choisit comme pour la page d'invitation.
 */

export type MusicSharePageLang = "fr" | "en";

export const MUSIC_SHARE_PAGE_TEXT = {
  fr: {
    otherLang: "English",
    kicker: "Playlist partagée",
    /** `{name}` : le compte qui partage. */
    by: "Par {name}",
    countOne: "1 titre",
    countOther: "{count} titres",
    more: "et {count} autres titres",
    importTitle: "L'écouter dans votre Tentacle",
    importLead: "Octave la recrée sur votre serveur : chaque titre que votre bibliothèque a y entre, le reste par votre extension de musique.",
    serverLabel: "L'adresse de votre Tentacle",
    serverPlaceholder: "https://mon-tentacle.exemple.fr",
    importButton: "Importer dans mon Tentacle",
    openApp: "Ouvrir dans l'app Tentacle",
    paste: "Ou copiez l'adresse de cette page et collez-la dans Octave, « Importer une playlist ».",
    badServer: "Cette adresse n'est pas celle d'un serveur. Elle commence par https:// ou http://.",
    unavailableTitle: "Lien indisponible",
    unavailableLead: "Ce lien a été révoqué par son auteur, ou ce partage n'est pas ouvert pour le moment. Demandez-lui un nouveau lien.",
    getApp: "Partagé avec Tentacle, un client pour Jellyfin.",
    getAppLink: "Découvrir Tentacle",
  },
  en: {
    otherLang: "Français",
    kicker: "Shared playlist",
    by: "By {name}",
    countOne: "1 track",
    countOther: "{count} tracks",
    more: "and {count} more tracks",
    importTitle: "Listen to it in your Tentacle",
    importLead: "Octave recreates it on your server: every track your library has goes in, the rest through your music extension.",
    serverLabel: "Your Tentacle's address",
    serverPlaceholder: "https://my-tentacle.example.com",
    importButton: "Import into my Tentacle",
    openApp: "Open in the Tentacle app",
    paste: "Or copy this page's address and paste it in Octave, “Import a playlist”.",
    badServer: "That isn't a server address. It starts with https:// or http://.",
    unavailableTitle: "Link unavailable",
    unavailableLead: "This link was revoked by its author, or this share isn't open right now. Ask them for a new link.",
    getApp: "Shared with Tentacle, a client for Jellyfin.",
    getAppLink: "Discover Tentacle",
  },
} as const satisfies Record<MusicSharePageLang, Record<string, string>>;
