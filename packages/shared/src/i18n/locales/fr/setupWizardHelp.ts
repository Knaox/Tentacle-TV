/**
 * L'assistant d'installation : « Besoin d'aide ? » au pied de chaque écran —
 * des questions-réponses courtes, une liste par étape
 * (`packages/shared/src/setupWizard/setupHelp.ts`). Fondu dans `setupWizard`.
 */
export default {
  helpToggle: "Besoin d'aide\u00a0?",
  helpDoc: "Lire la page d'aide",

  help_welcome_what_q: "Que fait cet assistant\u00a0?",
  help_welcome_what_a: "Il relie Tentacle à votre Jellyfin, crée ou reprend son compte administrateur et ses bibliothèques, puis vous ouvre Tentacle. Rien ne quitte votre maison.",
  help_welcome_time_q: "Combien de temps\u00a0?",
  help_welcome_time_a: "Cinq à dix minutes. Jellyfin peut redémarrer une fois, pour la détection des passages.",

  help_code_where_q: "Où trouver le code\u00a0?",
  help_code_where_a: "Dans le journal du conteneur Tentacle (Portainer\u00a0: Conteneurs › Tentacle › Journaux\u00a0; ou docker logs), ou dans le fichier data/setup-token.txt.",
  help_code_why_q: "Pourquoi un code\u00a0?",
  help_code_why_a: "Vous n'ouvrez pas l'assistant depuis votre réseau local\u00a0: le code prouve que vous avez la main sur le serveur.",

  help_database_which_q: "Quelle base de données\u00a0?",
  help_database_which_a: "MariaDB (ou MySQL\u00a08). Les piles «\u00a0complète\u00a0» et «\u00a0avec base\u00a0» la fournissent\u00a0: cet écran ne sert qu'à la pile «\u00a0Tentacle seul\u00a0» ou à une installation sans Docker.",
  help_database_fails_q: "La connexion échoue",
  help_database_fails_a: "Vérifiez l'adresse (pas localhost depuis un conteneur), le port 3306, l'utilisateur, son mot de passe, et que la base existe.",

  help_jellyfin_kinds_q: "Neuf ou déjà configuré\u00a0?",
  help_jellyfin_kinds_a: "Neuf\u00a0: Tentacle crée son compte administrateur et ses bibliothèques. Déjà configuré\u00a0: vous vous connectez avec le compte qui existe, et Tentacle ne crée rien (sauf des bibliothèques s'il n'en a aucune, si vous le voulez).",
  help_jellyfin_missing_q: "Mon Jellyfin n'est pas dans la liste",
  help_jellyfin_missing_a: "Tapez son adresse à la main, par exemple http://192.168.1.20:8096. Depuis un conteneur, localhost désigne le conteneur lui-même, pas votre serveur.",

  help_account_which_q: "Quel compte créer\u00a0?",
  help_account_which_a: "Le compte administrateur de Jellyfin, qui devient aussi le vôtre dans Tentacle\u00a0: même nom, même mot de passe.",
  help_account_stored_q: "Le mot de passe est-il enregistré\u00a0?",
  help_account_stored_a: "Non, jamais\u00a0: il ne fait que passer vers Jellyfin.",

  help_signIn_which_q: "Quel compte\u00a0?",
  help_signIn_which_a: "Un compte administrateur qui existe déjà sur ce Jellyfin. Il devient le vôtre dans Tentacle.",
  help_signIn_forgot_q: "J'ai oublié le mot de passe",
  help_signIn_forgot_a: "Réinitialisez-le dans Jellyfin (sa procédure «\u00a0Mot de passe oublié\u00a0»), puis revenez ici.",

  help_libraries_what_q: "Qu'est-ce qu'une bibliothèque\u00a0?",
  help_libraries_what_a: "Un dossier où Jellyfin cherche un type de contenu\u00a0: vos films d'un côté, vos séries de l'autre.",
  help_libraries_missing_q: "Je ne vois pas mes dossiers",
  help_libraries_missing_a: "Ce sont les dossiers vus par JELLYFIN. Dans un conteneur, seuls les dossiers montés existent\u00a0: dans la pile complète, /media est votre dossier MEDIA_PATH.",
  help_libraries_windows_q: "Et si Jellyfin tourne sous Windows\u00a0?",
  help_libraries_windows_a: "Les lecteurs du PC (C:, D:…) apparaissent à la racine\u00a0; choisissez par exemple D:\\Films.",

  help_recommended_all_q: "Faut-il tout cocher\u00a0?",
  help_recommended_all_a: "Non\u00a0: tout est facultatif, et rien ne change sans votre coche. «\u00a0Passer\u00a0» ne touche à rien.",
  help_recommended_restart_q: "Jellyfin va-t-il redémarrer\u00a0?",
  help_recommended_restart_a: "Seulement pour la détection des passages, une fois, et jamais pendant une lecture.",

  help_tmdb_what_q: "À quoi sert TMDB\u00a0?",
  help_tmdb_what_a: "Jellyfin décrit votre bibliothèque\u00a0; Tentacle interroge en plus The Movie Database pour ce qui la dépasse\u00a0: titres similaires, acteurs, sagas, plateformes de streaming.",
  help_tmdb_free_q: "Comment obtenir une clé\u00a0?",
  help_tmdb_free_a: "Créez un compte gratuit sur themoviedb.org, puis, dans ses paramètres, la section API\u00a0: demandez une clé pour un usage personnel et copiez la clé API v3 (32 caractères).",
  help_tmdb_later_q: "Et si je la pose plus tard\u00a0?",
  help_tmdb_later_a: "Tentacle fonctionne sans elle. Posez-la quand vous voulez dans Administration › Métadonnées\u00a0: le tableau de bord la rappelle dans ses recommandations, sans autre relance.",

  help_recap_what_q: "Que va-t-il se passer\u00a0?",
  help_recap_what_a: "Tentacle fait ce qui est listé, dans l'ordre, puis vous connecte. Rien d'autre.",
  help_recap_clientUrl_q: "L'adresse de Jellyfin pour les applications\u00a0?",
  help_recap_clientUrl_a: "Celle que vos appareils de la maison utilisent pour lire en direct, souvent http://adresse-du-serveur:port. Modifiable plus tard dans Administration › Services.",

  help_apply_what_q: "C'est long\u00a0?",
  help_apply_what_a: "Moins d'une minute en général\u00a0; un peu plus si Jellyfin redémarre pour la détection des passages.",
  help_apply_failed_q: "Une étape a échoué",
  help_apply_failed_a: "«\u00a0Réessayer\u00a0» la relance sans refaire ce qui a réussi. Les passages et les réglages ne bloquent jamais la fin.",

  help_remote_needed_q: "Faut-il l'activer\u00a0?",
  help_remote_needed_a: "Non. Coupé, Tentacle marche à la maison et rien n'est exposé. Allumez-le pour regarder hors de chez vous, maintenant ou plus tard.",
  help_remote_proxy_q: "Qu'est-ce qu'un mandataire\u00a0?",
  help_remote_proxy_a: "Un programme qui reçoit les visites d'Internet et ajoute le HTTPS. Tentacle n'en installe aucun\u00a0: si vous n'en avez pas, gardez «\u00a0Sans mandataire\u00a0».",
  help_remote_nothing_q: "Rien ne s'ouvre depuis l'extérieur",
  help_remote_nothing_a: "Votre opérateur partage peut-être votre adresse (CGNAT)\u00a0: voyez le plan B, un réseau privé comme Tailscale.",

  help_done_missing_q: "Mes films n'apparaissent pas",
  help_done_missing_a: "Attendez l'analyse de Jellyfin, ou relancez-la (Tableau de bord › Médiathèques). Vérifiez qu'ils sont bien dans le dossier de la bibliothèque.",
  help_done_reopen_q: "Comment rouvrir cet assistant\u00a0?",
  help_done_reopen_a: "Il se ferme pour de bon une fois fini. Pour tout recommencer\u00a0: la commande tentacle setup reset, dans le conteneur.",
};
