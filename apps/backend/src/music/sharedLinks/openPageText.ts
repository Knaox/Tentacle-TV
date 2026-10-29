/**
 * Les mots de la page d'ouverture d'un lien d'Octave (`/octave/open/<page>`), FR/EN — comme la page d'un lien
 * de playlist (`playlistShare/sharePageText.ts`) : le backend n'a pas les traductions de `shared`.
 */

export type OpenPageKind = "playlist" | "album" | "artist" | "mix" | "search";

export const OCTAVE_OPEN_PAGE_TEXT = {
  fr: {
    otherLang: "English",
    kicker: "Octave",
    title: { playlist: "Une playlist pour vous", album: "Un album pour vous", artist: "Un artiste pour vous", mix: "Un mix pour vous", search: "Une recherche pour vous" },
    lead: "Ouvrez ce lien dans Tentacle TV : l'app vous montre ce que votre compte peut écouter sur ce serveur.",
    openApp: "Ouvrir dans l'app Tentacle",
    openBrowser: "Ouvrir dans le navigateur",
    phone: "Le premier bouton ouvre l'app Tentacle TV si elle est installée sur cet appareil (téléphone ou ordinateur).",
    getApp: "Pas encore l'app ?",
    getAppLink: "Découvrir Tentacle",
  },
  en: {
    otherLang: "Français",
    kicker: "Octave",
    title: { playlist: "A playlist for you", album: "An album for you", artist: "An artist for you", mix: "A mix for you", search: "A search for you" },
    lead: "Open this link in Tentacle TV: the app shows what your account can listen to on this server.",
    openApp: "Open in the Tentacle app",
    openBrowser: "Open in the browser",
    phone: "The first button opens the Tentacle TV app if it is installed on this device (phone or computer).",
    getApp: "Don't have the app yet?",
    getAppLink: "Discover Tentacle",
  },
} as const;
