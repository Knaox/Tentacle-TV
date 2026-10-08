/**
 * La migration MariaDB → SQLite dans l'administration (serveur 1.25) : le
 * panneau de la carte « Base de données » et la marche à suivre pour retirer
 * MariaDB, par installation. Tentacle ne retire rien lui-même et ne parle jamais
 * à Docker : il dit quoi faire.
 */
export default {
  doneOn: "Migrée depuis MariaDB le {{date}}",
  doneFacts: "{{tables}} tables, {{rows}} lignes, en {{duration}}",
  sourceEmpty: "Migration : source vide, installation neuve",
  sourceLabel: "Ancienne base",
  cacheRunning: "Copie du cache en cours ({{percent}} %)",
  cacheRunningHint: "Le cache des fiches TMDB arrive depuis l'ancienne base, en fond : rien à faire.",
  unrecognized: "Tables non reconnues, copiées par précaution : {{names}}",
  retired: "Anciennes tables laissées dans MariaDB : {{names}}",
  refused: "Tables refusées (laissées dans MariaDB) : {{names}}",
  remigrateTitle: "Nouvelle migration",
  remigrateBody: "Repartir de l'ancienne base MariaDB : la base actuelle de ce serveur est gardée de côté (fichier .bak), rien n'est effacé.",
  remigrateButton: "Migrer à nouveau",
  remigrateConfirm: "Le serveur va redémarrer pour migrer à nouveau, avec l'écran d'attente pendant la copie.",
  remigrateFailed: "La demande n'a pas abouti. Réessayez dans un instant.",
  guideWarning: "Ne retirez MariaDB (ni ses variables DB_* ou DATABASE_URL) qu'après cette confirmation du tableau de bord — c'est le cas maintenant.",
  tabsLabel: "Votre installation",
  tab_officialStack: "Pile officielle",
  tab_compose: "Docker Compose",
  tab_portainer: "Portainer",
  tab_synology: "Synology",
  tab_unraid: "Unraid",
  tab_casaos: "CasaOS",
  tab_external: "Base externe",
  guide_officialStack: "Reprenez la nouvelle version de stacks/tentacle-full/compose.yaml : elle n'a plus de service {{service}}. Puis : docker compose up -d --remove-orphans. Gardez le volume de la base quelque temps, puis supprimez-le (docker volume ls, docker volume rm <nom>).",
  guide_compose: "Dans votre compose.yaml, supprimez le service {{service}} et, dans le service Tentacle, les variables DB_* et DATABASE_URL. Puis : docker compose up -d --remove-orphans. Gardez le volume de la base quelque temps, puis supprimez-le (docker volume rm <nom>).",
  guide_portainer: "Stacks → votre pile → Editor : supprimez le service {{service}} et les variables DB_* et DATABASE_URL de Tentacle, puis « Update the stack ». Plus tard : Volumes → le volume de la base → Remove.",
  guide_synology: "Container Manager → Projet → votre projet → Modifier : supprimez le service {{service}} et les variables DB_* de Tentacle, enregistrez et reconstruisez le projet. Plus tard, supprimez le dossier de la base.",
  guide_unraid: "Docker → le conteneur MariaDB → Stop, puis Remove. Dans le modèle du conteneur Tentacle, retirez les variables DB_* et DATABASE_URL, puis Apply. Les fichiers de MariaDB restent dans appdata jusqu'à ce que vous les effaciez.",
  guide_casaos: "Applications → MariaDB → Désinstaller. Dans les réglages de Tentacle, retirez les variables DB_* et DATABASE_URL, puis enregistrez.",
  guide_external: "Retirez les variables DB_* et DATABASE_URL de la pile Tentacle (ou le fichier data/database.json), puis redémarrez Tentacle. Ensuite, quand vous le souhaitez, supprimez la base Tentacle de votre serveur MariaDB avec cette commande — Tentacle n'exécute jamais rien sur l'ancienne base :",
  copy: "Copier",
  copied: "Copié",
} as const;
