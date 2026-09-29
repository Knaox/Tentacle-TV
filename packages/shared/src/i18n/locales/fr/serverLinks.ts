/**
 * Les liens du serveur — le lien public et la lecture directe. UNE source,
 * lue par la vue d'ensemble de l'administration et par l'assistant
 * d'installation ; la règle qui décide de l'état est dans
 * `serverLinks/serverLinksVerdict.ts`.
 *
 * Les clés `issue_*`, `note_*` et `benefit_*` suivent les identifiants du
 * verdict : ne pas les renommer sans eux.
 */
export default {
  sectionTitle: "Accès au serveur",
  sectionDescription: "Deux adresses rendent Tentacle utilisable partout, et plus fluide à la maison. Le serveur vérifie chacune.",
  progress: "{{done}} sur {{total}}",
  allDone: "Tout est en place",
  progressLabel: "Liens en place",

  check_publicUrl: "Lien public",
  check_directPlay: "Lecture directe (réseau local et Internet)",
  summary_publicUrl: "L'adresse de Tentacle sur Internet.",
  summary_directPlay: "Les appareils lisent chez Jellyfin, sans que la vidéo passe par le serveur Tentacle.",
  whyTitle: "Pourquoi ?",
  benefit_publicUrl_away: "Hors de chez vous : vos films et séries en 4G, en vacances, chez des amis.",
  benefit_publicUrl_apps: "Apps mobiles et téléviseurs : c'est l'adresse qu'ils reçoivent au jumelage et que portent les invitations. Sans elle, le jumelage d'un téléviseur est bloqué.",
  benefit_publicUrl_shares: "Partages : un lien de statistiques ou de Ma liste ne s'ouvre chez vos proches que si le serveur se joint depuis Internet.",
  benefit_directPlay_quality: "Meilleure qualité : le fichier arrive tel quel depuis Jellyfin, sans détour. Démarrage plus rapide, avance et retour plus vifs.",
  benefit_directPlay_load: "Moins de charge : le serveur Tentacle ne relaie plus la vidéo, il se contente d'aiguiller.",
  benefit_directPlay_local: "À la maison, l'adresse du réseau local : la vidéo ne sort pas sur Internet, c'est le chemin le plus court. Dehors, l'adresse publique prend le relais, toute seule.",
  levelRecommended: "Recommandé",

  state_done: "Fait",
  state_todo: "À faire",
  state_attention: "À vérifier",
  state_unknown: "Non vérifié",

  role_tentacle: "Tentacle sur Internet",
  role_jellyfinPublic: "Jellyfin sur Internet",
  role_jellyfinPrivate: "Jellyfin sur le réseau local",
  endpointMissing: "Pas renseignée",
  probe_ok_tentacle: "Répond — c'est bien ce serveur",
  probe_ok_jellyfin: "Répond — Jellyfin {{version}}",

  "issue_not-public": "Adresse du réseau local : elle ne se joint pas depuis Internet.",
  "issue_internal-host": "Adresse que seul le serveur comprend (localhost, nom de conteneur Docker) : les appareils ne la joignent pas.",
  "issue_not-https": "Sans HTTPS : mots de passe et jetons circulent en clair sur Internet.",
  "issue_mixed-content": "En http:// alors que Tentacle est en https:// : les navigateurs bloquent ce flux (les applications, non).",
  "issue_cors-missing": "Jellyfin n'autorise pas l'adresse de Tentacle (CORS) : la lecture directe échoue dans un navigateur. Réenregistrer la lecture directe l'y ajoute.",
  "issue_other-server": "Répond, mais ce n'est pas ce serveur.",
  "issue_other-server_jellyfinPublic": "Répond, mais ce n'est pas le Jellyfin connecté à Tentacle.",
  "issue_other-server_jellyfinPrivate": "Répond, mais ce n'est pas le Jellyfin connecté à Tentacle.",
  "issue_unexpected": "Quelque chose répond, qui n'est ni Tentacle ni Jellyfin.",
  "issue_http-error": "Répond par une erreur HTTP {{status}}.",
  "issue_unverified": "Le serveur ne s'est pas joint par cette adresse. Si elle s'ouvre depuis un téléphone en 4G, tout va bien : certaines box ne laissent pas une machine se joindre par son adresse publique.",
  "issue_unverified_jellyfinPrivate": "Le serveur ne joint pas Jellyfin par cette adresse. Vérifiez-la depuis un appareil de la maison.",

  "note_direct-disabled": "Lecture directe coupée : toute la vidéo passe par le serveur Tentacle.",
  "note_legacy-relayed": "Les applications pas encore à jour lisent quand même par le serveur Tentacle : ce Jellyfin refuse leur ancienne authentification.",
  "note_from-env": "Vient de la variable d'environnement TENTACLE_PUBLIC_URL.",

  actionSet: "Renseigner",
  actionEdit: "Modifier",
  recheck: "Revérifier",
  checking: "Vérification…",
  loadError: "Impossible de vérifier les liens du serveur.",
  retry: "Réessayer",
  outdatedServer: "Mettez à jour le serveur Tentacle pour qu'il vérifie ses liens.",

  stepLabel: "Accès",
  wizardTitle: "Accès depuis partout",
  wizardSubtitle: "Facultatif — deux adresses recommandées. Vous pourrez y revenir depuis la vue d'ensemble de l'administration.",
  wizardLater: "Rien n'est obligatoire : sans ces adresses, Tentacle marche à la maison et toute la vidéo passe par le serveur.",
  fieldTentacle: "Lien public de Tentacle",
  fieldTentacleHint: "L'adresse de ce serveur sur Internet, de préférence en https://.",
  fieldJellyfinPublic: "Jellyfin sur Internet",
  fieldJellyfinPublicHint: "Pour lire en direct hors de chez vous.",
  fieldJellyfinPrivate: "Jellyfin sur le réseau local",
  fieldJellyfinPrivateHint: "Pour lire en direct à la maison.",
  suggested: "Proposée d'après votre installation — modifiez-la si besoin.",
  directNeedsBoth: "La lecture directe s'allume quand les deux adresses de Jellyfin sont renseignées.",
  invalidUrl: "Adresse invalide — elle commence par http:// ou https://.",
  check: "Vérifier",
  skip: "Passer pour l'instant",
  saveAndFinish: "Enregistrer et terminer",
  saving: "Enregistrement…",
  saveError: "Enregistrement impossible : {{message}}",
} as const;
