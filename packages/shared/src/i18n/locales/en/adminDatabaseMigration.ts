/**
 * The MariaDB → SQLite migration in the administration (server 1.25): the
 * « Database » card's panel and how to remove MariaDB, per installation.
 * Tentacle removes nothing by itself and never talks to Docker: it says what to do.
 */
export default {
  doneOn: "Migrated from MariaDB on {{date}}",
  doneFacts: "{{tables}} tables, {{rows}} rows, in {{duration}}",
  sourceEmpty: "Migration: empty source, new installation",
  sourceLabel: "Old database",
  cacheRunning: "Copying the cache ({{percent}} %)",
  cacheRunningHint: "The TMDB title cache is coming from the old database, in the background: nothing to do.",
  unrecognized: "Unrecognized tables, copied as a precaution: {{names}}",
  retired: "Old tables left in MariaDB: {{names}}",
  refused: "Refused tables (left in MariaDB): {{names}}",
  remigrateTitle: "New migration",
  remigrateBody: "Start again from the old MariaDB database: this server's current database is kept aside (.bak file), nothing is erased.",
  remigrateButton: "Migrate again",
  remigrateConfirm: "The server will restart to migrate again, with the waiting screen during the copy.",
  remigrateFailed: "The request did not go through. Try again in a moment.",
  guideWarning: "Remove MariaDB (and its DB_* or DATABASE_URL variables) only after this confirmation from the dashboard — which is the case now.",
  tab_officialStack: "Official stack",
  tab_compose: "Docker Compose",
  tab_portainer: "Portainer",
  tab_synology: "Synology",
  tab_unraid: "Unraid",
  tab_casaos: "CasaOS",
  tab_external: "External database",
  guide_officialStack: "Take the new version of stacks/tentacle-full/compose.yaml: it no longer has a {{service}} service. Then: docker compose up -d --remove-orphans. Keep the database volume for a while, then remove it (docker volume ls, docker volume rm <name>).",
  guide_compose: "In your compose.yaml, remove the {{service}} service and, in the Tentacle service, the DB_* and DATABASE_URL variables. Then: docker compose up -d --remove-orphans. Keep the database volume for a while, then remove it (docker volume rm <name>).",
  guide_portainer: "Stacks → your stack → Editor: remove the {{service}} service and Tentacle's DB_* and DATABASE_URL variables, then « Update the stack ». Later: Volumes → the database volume → Remove.",
  guide_synology: "Container Manager → Project → your project → Edit: remove the {{service}} service and Tentacle's DB_* variables, save and rebuild the project. Later, delete the database folder.",
  guide_unraid: "Docker → the MariaDB container → Stop, then Remove. In the Tentacle container's template, remove the DB_* and DATABASE_URL variables, then Apply. MariaDB's files stay in appdata until you delete them.",
  guide_casaos: "Apps → MariaDB → Uninstall. In Tentacle's settings, remove the DB_* and DATABASE_URL variables, then save.",
  guide_external: "Remove the DB_* and DATABASE_URL variables from the Tentacle stack (or the data/database.json file), then restart Tentacle. Then, whenever you wish, delete the Tentacle database from your MariaDB server with this command — Tentacle never runs anything on the old database:",
  copy: "Copy",
  copied: "Copied",
} as const;
