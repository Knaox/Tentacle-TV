/**
 * Partager ses statistiques — le panneau du PROPRIÉTAIRE (web, bureau,
 * miroir, mobile) : la période partagée, ce qui devient public et ce qui
 * reste privé, le lien et sa révocation.
 *
 * ⚠️ Lu aussi par le MOBILE : jamais « téléchargement » ni « download » ici.
 */
export default {
  button: "Partager",
  title: "Partager mes statistiques",
  lead: "Une page publique, ouverte sans compte. On y lit vos chiffres, rien d'autre : aucun film ni aucune série ne s'y lance.",

  periodLabel: "Période partagée",
  period_30d: "30 derniers jours",
  period_year: "Cette année",
  period_all: "Depuis le début",

  publicTitle: "Ce qui sera public",
  public_time: "Votre temps passé, vos films, épisodes et jours de visionnage",
  public_profile: "Votre profil de spectateur et vos grands moments de la journée",
  public_tastes: "Vos genres, formats, décennies, origines, VF ou VO",
  public_titles: "Vos films préférés, vos séries et vos têtes d'affiche, avec vos notes",
  public_records: "Vos records, datés au mois",
  public_loves: "Ce que vous aimez",
  privateTitle: "Reste privé",
  private_hours: "Vos heures de visionnage, jour par jour",
  private_devices: "Vos écrans et vos applications",
  private_dates: "Les dates exactes de vos séances",
  private_place: "Votre fuseau horaire",
  private_list: "Ma liste et « À voir »",

  create: "Créer le lien",
  creating: "Création du lien…",
  linkActive: "Lien actif · {{period}}",
  preview: "Voir la page publique",
  shareLink: "Partager le lien",
  periodSaved: "Lien mis à jour : {{period}}",
  periodSaving: "Mise à jour du lien…",

  revoke: "Révoquer le lien",
  revokeConfirmTitle: "Révoquer ce lien ?",
  revokeConfirmBody: "La page publique cessera de s'ouvrir pour tous ceux qui ont le lien. Vous pourrez en créer un nouveau ensuite.",
  revokeConfirm: "Révoquer",
  cancel: "Annuler",
  revoked: "Lien révoqué : la page publique ne s'ouvre plus.",

  error: "Impossible de créer le lien. Réessayez dans un instant.",
  revokeError: "Impossible de révoquer le lien. Réessayez dans un instant.",
  outdated: "Le serveur doit être mis à jour pour partager vos statistiques.",
  shareFailed: "Partage impossible. Le lien reste affiché : copiez-le.",
} as const;
