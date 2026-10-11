import type { RegisterRefusalCode } from "../routes/authAccount";

/**
 * Les mots de la page d'invitation du SERVEUR (FR/EN). Le backend ne dépend pas
 * de `@tentacle-tv/shared` (image sans packages/) : ils sont ici, repris de
 * l'espace i18n `auth` des clients pour le formulaire. Chaque refus de
 * l'inscription (`RegisterRefusalCode`) a sa phrase : la compilation refuse un
 * code nouveau sans elle.
 */
export type InvitePageLang = "fr" | "en";

/** Ce que la page sait dire en plus des refus du serveur. */
type PageErrors = Record<RegisterRefusalCode | "invalid_fields" | "too_many" | "offline" | "other", string>;

export interface InvitePageText {
  title: string;
  subtitle: string;
  inviteKey: string;
  inviteKeyHint: string;
  username: string;
  usernameHint: string;
  password: string;
  passwordHint: string;
  confirmPassword: string;
  showPasswords: string;
  hidePasswords: string;
  submit: string;
  creating: string;
  mismatch: string;
  noScript: string;
  doneTitle: string;
  doneBody: string;
  serverAddress: string;
  copy: string;
  copied: string;
  getApp: string;
  getAppLink: string;
  otherLang: string;
  errors: PageErrors;
}

export const INVITE_PAGE_TEXT: Record<InvitePageLang, InvitePageText> = {
  fr: {
    title: "Rejoindre Tentacle TV",
    subtitle: "Inscription réservée aux invités",
    inviteKey: "Clé d'invitation",
    inviteKeyHint: "Fournie par l'administrateur de votre serveur.",
    username: "Nom d'utilisateur",
    usernameHint: "Lettres, chiffres, espaces et . - _ ' @ +",
    password: "Mot de passe",
    passwordHint: "6 caractères au moins.",
    confirmPassword: "Confirmer le mot de passe",
    showPasswords: "Afficher les mots de passe",
    hidePasswords: "Masquer les mots de passe",
    submit: "Créer un compte",
    creating: "Création du compte…",
    mismatch: "Les mots de passe ne correspondent pas.",
    noScript: "Cette page a besoin de JavaScript pour créer votre compte.",
    doneTitle: "Votre compte est créé",
    doneBody: "Connectez-vous avec ce nom et ce mot de passe dans l'application Tentacle TV, sur ordinateur, téléphone ou téléviseur. Elle vous demandera l'adresse de ce serveur :",
    serverAddress: "Adresse du serveur",
    copy: "Copier",
    copied: "Copiée",
    getApp: "Pas encore l'application ?",
    getAppLink: "Toutes les applications sur tentacletv.app",
    otherLang: "English",
    errors: {
      invite_invalid: "Cette clé d'invitation n'existe pas. Vérifiez-la, ou demandez un nouveau lien à l'administrateur.",
      invite_exhausted: "Cette invitation a déjà servi autant de fois que prévu. Demandez un nouveau lien à l'administrateur.",
      invite_expired: "Cette invitation a expiré. Demandez un nouveau lien à l'administrateur.",
      username_taken: "Ce nom d'utilisateur est déjà pris : choisissez-en un autre.",
      username_invalid: "Ce nom n'est pas accepté : lettres, chiffres, espaces et . - _ ' @ + seulement.",
      jellyfin_unconfigured: "Ce serveur n'est pas encore prêt à créer des comptes. Prévenez son administrateur.",
      account_creation_failed: "Le compte n'a pas pu être créé. Réessayez dans un instant ; si cela se répète, prévenez l'administrateur.",
      invalid_fields: "Le nom d'utilisateur compte de 3 à 50 caractères, le mot de passe 6 au moins.",
      too_many: "Trop d'essais d'affilée : réessayez dans une minute.",
      offline: "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.",
      other: "L'inscription a échoué. Réessayez dans un instant.",
    },
  },
  en: {
    title: "Join Tentacle TV",
    subtitle: "Invitation-only registration",
    inviteKey: "Invite key",
    inviteKeyHint: "Provided by your server's administrator.",
    username: "Username",
    usernameHint: "Letters, digits, spaces and . - _ ' @ +",
    password: "Password",
    passwordHint: "At least 6 characters.",
    confirmPassword: "Confirm password",
    showPasswords: "Show passwords",
    hidePasswords: "Hide passwords",
    submit: "Create an account",
    creating: "Creating account…",
    mismatch: "Passwords do not match.",
    noScript: "This page needs JavaScript to create your account.",
    doneTitle: "Your account is ready",
    doneBody: "Sign in with this username and password in the Tentacle TV app, on a computer, phone or TV. It will ask for this server's address:",
    serverAddress: "Server address",
    copy: "Copy",
    copied: "Copied",
    getApp: "No app yet?",
    getAppLink: "Every app on tentacletv.app",
    otherLang: "Français",
    errors: {
      invite_invalid: "This invite key does not exist. Check it, or ask the administrator for a new link.",
      invite_exhausted: "This invitation has already been used as many times as allowed. Ask the administrator for a new link.",
      invite_expired: "This invitation has expired. Ask the administrator for a new link.",
      username_taken: "This username is already taken: pick another one.",
      username_invalid: "This username is not accepted: letters, digits, spaces and . - _ ' @ + only.",
      jellyfin_unconfigured: "This server cannot create accounts yet. Let its administrator know.",
      account_creation_failed: "The account could not be created. Try again in a moment; if it keeps happening, let the administrator know.",
      invalid_fields: "The username takes 3 to 50 characters, the password at least 6.",
      too_many: "Too many attempts in a row: try again in a minute.",
      offline: "The server does not answer. Check your connection, then try again.",
      other: "Registration failed. Try again in a moment.",
    },
  },
};

/** `?lang=` l'emporte ; sinon le français si le navigateur le met en tête, l'anglais sinon. */
export function invitePageLang(acceptLanguage: string | undefined, requested?: unknown): InvitePageLang {
  if (requested === "fr" || requested === "en") return requested;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}
