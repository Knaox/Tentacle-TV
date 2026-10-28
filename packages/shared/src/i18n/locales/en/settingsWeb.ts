/**
 * Les RÉGLAGES du web large et du bureau — version anglaise (voir
 * `fr/settingsWeb.ts`).
 */
export default {
  rail: {
    watch: "Watching",
    interface: "Interface",
    you: "You",
  },
  search: {
    label: "Search settings",
    placeholder: "Search a setting",
    clear: "Clear search",
    title: "Results for “{{query}}”",
    count_one: "{{count}} setting",
    count_other: "{{count}} settings",
    empty: "No setting matches “{{query}}”.",
    emptyHint: "Try a shorter or different word: “subtitles”, “theme”, “intro”, “password”…",
    where: "{{section}} › {{group}}",
  },
  detailToggle: "Fine-tune",
  scopeLegend: "“Account”: saved with your account, it follows you on all your devices. “This device”: only applies to this browser or computer.",
  sections: {
    playback: {
      label: "Playback",
      intro: "What the player does on its own, and this computer's video.",
    },
    languages: {
      label: "Languages & subtitles",
      intro: "The audio tracks and subtitles picked by default for each library, and the language of the menus. Saved with your account.",
    },
    downloads: {
      label: "Downloads",
      intro: "Where titles downloaded to this computer are stored, and how they arrive.",
    },
    appearance: {
      label: "Appearance",
      intro: "How the app looks. These settings only apply to this device.",
    },
    personalization: {
      label: "Home & discovery",
      intro: "What the home screen shows, how cards react, and what recommendations may use.",
    },
    family: {
      label: "Family",
      intro: "Your family's profiles, your PIN code, and “Who's watching?” at launch.",
    },
    security: {
      label: "Account & security",
      intro: "Your password, paired devices, linked accounts, and what only affects this device.",
    },
  },
  groups: {
    playback: {
      player: "Skips & autoplay",
      stillWatching: "Automatic pause",
      data: "Connection",
      video: "Video on this computer",
    },
    languages: {
      tracks: "Audio & subtitles per library",
      interface: "Interface language",
    },
    downloads: {
      storage: "Storage",
      transfers: "Transfers",
    },
    appearance: {
      theme: "Theme",
      effects: "Effects",
      octave: "Octave",
    },
    personalization: {
      startup: "At launch",
      hero: "Main banner",
      rows: "Home rows",
      previews: "Hover previews",
      reco: "Recommendations",
    },
    family: {
      profiles: "Profiles",
      myPin: "My PIN code",
      launch: "At launch",
      leave: "Leave",
    },
    security: {
      signIn: "Sign-in",
      linked: "Linked accounts",
      thisDevice: "This device",
      danger: "Danger zone",
    },
  },
  entries: {
    playbackMode: {
      label: "What the player does",
      description: "Choose whether the player skips credits, recaps and previews by itself, or offers to.",
      keywords: "mode, skip, automatic, intro, credits",
    },
    skipPassages: {
      label: "Passages, one by one",
      description: "For the intro, recap, end credits and preview: skip on its own, offer a button or do nothing, and after how long.",
      keywords: "intro, opening, credits, recap, preview, skip, delay, countdown",
    },
    upNext: {
      label: "Next episode",
      description: "The “Up next” card during the credits, its countdown and autoplay.",
      keywords: "up next, autoplay, countdown, next, binge",
    },
    stillWatching: {
      label: "Ask if you're still watching",
      description: "After a long time without touching anything, playback asks, then pauses if nobody answers.",
      keywords: "are you there, still watching, pause, sleep, idle",
    },
    dataSaver: {
      label: "Data saver",
      description: "Lighter images and fewer calls to the server on a slow or metered connection.",
      keywords: "data, slow connection, 4G, hotspot, metered, bandwidth, quality",
    },
    hardwareDecoding: {
      label: "Hardware decoding",
      description: "What decodes the video: the graphics card, or the processor if the picture breaks up (blocks, artifacts).",
      keywords: "GPU, graphics card, driver, artifacts, blocks, macroblocks, hwdec, CPU, software",
    },
    hdrAuto: {
      label: "Switch the display to HDR",
      description: "Turns HDR on for the display while an HDR movie plays, then puts it back.",
      keywords: "HDR, Dolby Vision, display, Windows, colors, brightness",
    },
    linuxSession: {
      label: "Video display (Wayland or X11)",
      description: "Wayland allows HDR; X11 allows windowed playback. Takes effect at next launch.",
      keywords: "Wayland, X11, XWayland, Linux, HDR, window, fullscreen, KDE, GNOME",
    },
    interfaceLanguage: {
      label: "Interface language",
      description: "The language of Tentacle's menus and buttons.",
      keywords: "language, French, English, translation, menus",
    },
    libraryTracks: {
      label: "Playback languages per library",
      description: "For each library, the audio language and subtitles picked by default when playback starts.",
      keywords: "subtitles, audio, track, dub, original, language, anime, forced, captions",
    },
    downloadsLocation: {
      label: "Location",
      description: "The folder where downloaded titles are stored on this computer.",
      keywords: "folder, disk, storage, path, location",
    },
    downloadsSpace: {
      label: "Disk space",
      description: "How much space your downloads take, and how much is left.",
    },
    downloadsBackground: {
      label: "Continue in the background",
      description: "Closing the window lets ongoing downloads finish, movies and music; Tentacle closes afterwards.",
      keywords: "background, close, window, continue, downloads, music, Octave, transfer",
    },
    theme: {
      label: "Theme",
      description: "Light, dark, or the same as the system.",
      keywords: "dark, light, night, color, mode",
    },
    liquidGlass: {
      label: "Liquid Glass",
      description: "Gives bars, menus and the player the macOS glass.",
      keywords: "glass, transparency, macOS, effect, blur",
    },
    octaveAppearance: {
      label: "Octave appearance",
      description: "The theme and glass of the music mode, set apart from Tentacle.",
      keywords: "music, Octave, theme, dark, light",
    },
    octaveStartup: {
      label: "At launch, open",
      description: "What the app opens when it starts: Octave, Tentacle, or the last mode used.",
      keywords: "launch, startup, Octave, music, open",
    },
    heroSource: {
      label: "Main banner",
      description: "What the big carousel at the top of the home screen shows.",
      keywords: "carousel, hero, banner, home, top",
    },
    cardDensity: {
      label: "Card size",
      description: "The size of posters in the home rows.",
      keywords: "posters, density, compact, large, cards",
    },
    homeRows: {
      label: "Rows and their order",
      description: "The rows under the banner: reorder them, or hide some without deleting them.",
      keywords: "home, rows, order, hide, continue watching, recently added",
    },
    trailerPreviews: {
      label: "Hover previews",
      description: "Rest the pointer on a poster: its trailer starts, with sound.",
      keywords: "trailer, hover, video, sound, preview",
    },
    trailerPreviewDelay: {
      label: "Delay before the preview",
      description: "How long to rest the pointer on a poster before its trailer appears.",
      keywords: "trailer, delay, wait, hover",
    },
    trendingNow: {
      label: "Trending now",
      description: "At the top of “For you”, what's most watched this week, regardless of your taste.",
      keywords: "trending, popular, week, for you",
    },
    recoPersonalized: {
      label: "Personalized recommendations",
      description: "Suggestions built from your ratings, favorites and viewing.",
      keywords: "for you, suggestions, taste, recommendations",
    },
    recoVigie: {
      label: "Include titles outside the library",
      description: "Also suggests titles missing from the library, which can be requested.",
      keywords: "request, missing, catalog, Vigie, outside library",
    },
    recoCommunity: {
      label: "Community recommendations",
      description: "The “Tentacle users also watch” row.",
      keywords: "community, other users, also watch",
    },
    recoShareHistory: {
      label: "Share my history with the community",
      description: "Your viewing feeds, anonymously, into community recommendations.",
      keywords: "privacy, history, anonymous, share",
    },
    recoBalance: {
      label: "Suggestion balance",
      description: "Towards “Safe”, titles close to your taste; towards “Adventurous”, more discoveries.",
      keywords: "discovery, adventurous, safe, slider, exploration",
    },
    recoReset: {
      label: "Reset my taste profile",
      description: "Erases the computed profile and rebuilds it from your ratings and history.",
      keywords: "reset, erase, taste, start over",
    },
    familyProfiles: {
      label: "Family profiles",
      description: "Your family's members and guests, their rights and their invitations.",
      keywords: "family, members, guests, kids, parental control, rights, invite, profiles",
    },
    familyPin: {
      label: "My PIN code",
      description: "The code protecting your profile when a shared device asks “Who's watching?”.",
      keywords: "PIN, code, lock, protect, profile",
    },
    askAtLaunch: {
      label: "Ask “Who's watching?” at launch",
      description: "Each time the app opens, choose the profile watching on this device.",
      keywords: "who's watching, profile, launch, choose, startup",
    },
    familyLeave: {
      label: "Leave or dissolve the family",
      description: "Leave the family (member), or dissolve it (owner).",
      keywords: "leave, dissolve, delete family",
    },
    password: {
      label: "Password",
      description: "Change your account password, on all your devices.",
      keywords: "password, security, sign in",
    },
    pairedDevices: {
      label: "Paired devices",
      description: "TVs and devices connected to your account with a code; remove the ones you no longer use.",
      keywords: "TV, Apple TV, Android TV, pairing, code, revoke, devices",
    },
    linkedAccounts: {
      label: "TMDB and your ratings",
      description: "Where your ratings go, anonymously, and their sync.",
      keywords: "TMDB, ratings, linked accounts, sync, rate",
    },
    changeServer: {
      label: "Change server",
      description: "Connect this app to another Tentacle server.",
      keywords: "server, address, URL, sign out, other server",
    },
    clearCache: {
      label: "Clear cache",
      description: "Resets this device's settings to their defaults and clears its cache, without signing you out.",
      keywords: "cache, reset, bug, problem, erase, memory",
    },
    deleteAccount: {
      label: "Delete my account",
      description: "Permanently deletes your account and what belongs to it on this server.",
      keywords: "delete, erase, account, GDPR, close",
    },
  },
};
