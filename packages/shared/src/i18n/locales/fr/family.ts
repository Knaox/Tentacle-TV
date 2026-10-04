/**
 * La Famille — les mots COMMUNS à tous les clients (web, bureau, mobile,
 * Apple TV) : rôles, affiche d'invitation, cloche, refus du serveur (un par
 * code de `family/familyContract.ts`). Les écrans de chaque client ajoutent
 * les leurs à part. Lus par le mobile : le mot « téléchargement » n'y entre pas.
 */
export default {
  kindOwner: "Propriétaire",
  kindMember: "Membre",
  kindGuest: "Invité",
  /** Les sessions en cours : un invité y est étiqueté, jamais listé ailleurs. */
  guestOf: "Invité · famille de {{owner}}",
  /** v2 : un invité, et qui l'a créé. */
  addedBy: "Ajouté par {{name}}",
  /** v2 : les droits que le propriétaire règle, par profil. */
  rights: {
    createGuests: "Peut créer des invités",
    createGuestsHint: "Crée ses propres invités et ne supprime que ceux-là, dans la limite de trois pour toute la famille.",
    requestTitles: "Peut demander des films",
    requestTitlesHint: "Ses demandes partent à son nom.",
  },
  /** v2 : un compte de la liste qu'on ne peut pas inviter, et pourquoi. */
  candidates: {
    inFamily: "Déjà dans une famille",
    invited: "Invitation en attente",
  },
  /** Changer ou retirer SON code exige l'actuel (`SetOwnPinBody.currentPin`). */
  pin: {
    currentLabel: "Code actuel",
    currentHint: "Pour changer ou retirer votre code, saisissez d'abord celui en place.",
    currentMissing: "Saisissez votre code actuel, quatre chiffres.",
    attemptsLeft_one: "Encore {{count}} essai avant blocage.",
    attemptsLeft_other: "Encore {{count}} essais avant blocage.",
  },
  poster: {
    title: "{{owner}} vous invite à rejoindre sa famille",
    profile: "Votre profil s'ouvrira sur les TV de {{owner}} sans mot de passe, sauf si vous posez un code PIN.",
    leave: "Vous pourrez quitter la famille à tout moment.",
    accept: "Accepter",
    decline: "Refuser",
    later: "Plus tard",
  },
  notifications: {
    family_invite: "{{name}} vous invite à rejoindre sa famille",
    family_invite_accepted: "{{name}} a rejoint votre famille",
    family_invite_declined: "{{name}} a refusé votre invitation",
    family_member_left: "{{name}} a quitté votre famille",
    family_member_removed: "{{name}} vous a retiré de sa famille",
    family_dissolved: "{{name}} a dissous sa famille",
  },
  errors: {
    invalid_input: "La demande est incomplète ou mal formée.",
    pin_format: "Le code PIN compte exactement quatre chiffres.",
    candidate_invalid: "Ce compte ne peut pas être invité.",
    pairing_required: "Cette TV doit être jumelée de nouveau.",
    disabled: "Les familles sont désactivées sur ce serveur.",
    guests_disabled: "Les profils invités sont désactivés sur ce serveur.",
    personal_session_required: "Ce geste se fait depuis votre propre session : le web, l'application de bureau ou le mobile.",
    not_owner: "Seul le propriétaire de la famille peut faire ce geste.",
    manage_locked: "Saisissez votre code PIN pour gérer les profils.",
    guest_account: "Un profil invité ne peut ni créer ni rejoindre de famille.",
    review_account: "Indisponible sur le compte de démonstration.",
    guest_right_required: "Le propriétaire de la famille ne vous a pas permis de créer des profils invités.",
    owner_must_dissolve: "Le propriétaire ne quitte pas sa famille : il peut la dissoudre.",
    pin_required: "Ce profil est protégé par un code PIN.",
    pin_invalid: "Code PIN incorrect.",
    not_found: "Introuvable : cet élément n'existe plus.",
    full: "La famille est complète : six profils au plus, propriétaire compris.",
    guests_full: "Trois profils invités au plus par famille.",
    already_member: "Ce compte fait déjà partie de la famille.",
    already_in_family: "Ce compte fait déjà partie d'une famille : un compte n'en rejoint qu'une.",
    invite_pending: "Une invitation attend déjà la réponse de ce compte.",
    invite_closed: "Cette invitation n'est plus valable.",
    invite_expired: "Cette invitation a expiré.",
    enroll_required: "Cette TV doit d'abord passer aux profils.",
    profile_unavailable: "Ce profil n'est plus disponible sur cette TV.",
    pin_locked: "Trop d'essais : réessayez plus tard.",
    invite_cooldown: "Ce compte a refusé votre invitation récemment : réessayez plus tard.",
    invite_quota: "Trop d'invitations pour le moment : réessayez plus tard.",
    guest_quota: "Trop de profils invités créés aujourd'hui : réessayez plus tard.",
    jellyfin_refused: "Jellyfin a refusé l'opération.",
    jellyfin_unavailable: "Jellyfin ne répond pas : réessayez dans un instant.",
  },
} as const;
