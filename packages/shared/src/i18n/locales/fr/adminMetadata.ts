/**
 * Admin → Métadonnées : la clé TMDB, le calcul des recommandations et la
 * région des plateformes. Le libellé du rail (`admin:metadataTitle`) et le
 * bandeau « clé manquante » (`admin:tmdbKey*`) restent dans `admin`.
 */
export default {
  title: "Métadonnées",
  description:
    "Ce qui enrichit Tentacle au-delà de Jellyfin : TMDB pour les recommandations, et le pays dont les plateformes de streaming s'affichent.",
  loadError: "Impossible de lire la configuration des métadonnées.",
  loadErrorHint: "Le serveur Tentacle n'a pas répondu. Vérifiez la connexion, puis réessayez.",
  retry: "Réessayer",
} as const;
