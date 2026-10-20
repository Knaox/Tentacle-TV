/**
 * La Famille sur le mobile et l'iPad — en anglais. Voir l'en-tête de
 * `fr/familyMobile.ts`.
 */
export default {
  inviteHint: "An account on this server: they answer from their own app.",
  addGuestHint: "A profile without a password, which opens on the family's devices from “Who's watching?”.",
  /** La validation de la feuille « invité », à côté de son titre : un mot. */
  create: "Create",
  openProfileHint: "Opens this profile's settings",
  posterLabel: "Invitation to join a family",
  pinShow: "Show digits",
  pinHide: "Hide digits",
  // v2 — ce que seul le mobile dit (les mots communs vivent dans `family`).
  memberMayCreate: "The owner lets you create guests: you manage the ones you create.",
  /** "Who's watching?" on phone and iPad (server 1.31.1, `family.mobileProfiles`). */
  launch: {
    caption: "This device will remember your choice. To switch profiles: Settings › Account.",
    switchCaption: "The chosen profile opens on this device and stays until you switch again.",
    cancel: "Cancel",
    guest: "Guest",
    owner: "Owner",
    member: "Member",
    opening: "Opening…",
    loading: "Loading family profiles…",
  },
  /** First launch, after signing in: PIN, home, photo — every step can be skipped. */
  firstRun: {
    step: "Step {{current}} of {{total}}",
    skip: "Skip",
    next: "Continue",
    finish: "Done",
    pinTitle: "Protect your profile",
    pinBody: "A four-digit PIN keeps other family members from opening your profile, here and on the family's other devices.",
    pinSet: "Set a PIN",
    pinDone: "PIN set.",
    homeTitle: "Your home screen",
    homeBody: "Choose the home rows and their order. They follow your account: the web and desktop show the same. You can change everything later in Settings.",
    homeLoading: "Loading your home screen…",
    homeUnavailable: "Your home screen couldn't be loaded. You can set it up later in Settings.",
    photoTitle: "Your photo",
    photoBody: "Pick a character or import a photo: it follows you on all your devices, TVs included.",
    photoChoose: "Choose my photo",
    photoDone: "Photo chosen.",
  },
  /** The "Switch profile" sheet (header, Settings › Account, Profile tab). */
  switcher: {
    back: "Profiles",
    switched: "You're now watching as {{name}}",
    close: "Close",
  },
} as const;
