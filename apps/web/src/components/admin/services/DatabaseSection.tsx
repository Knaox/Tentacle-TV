import { useTranslation } from "react-i18next";
import { AdminNotice, AdminSection } from "../kit";
import { SectionBadges, SectionError, SectionSkeleton } from "./SectionParts";
import type { DatabaseService } from "./servicesModel";
import { databaseEngineName, formatBytes, formatDatabaseVersion, summarizeDatabase } from "./serviceSummary";
import { useServicesStatus } from "./useServicesData";

/**
 * La base du serveur, en lecture seule. Depuis 1.25, un fichier SQLite dans
 * le dossier de données : rien à régler, seulement à constater — moteur,
 * version, fichier, taille, état (la pastille, et la cause quand elle ne
 * s'ouvre pas) — et un avertissement si ce dossier est sur un partage
 * réseau, où SQLite peut se corrompre.
 *
 * Un serveur d'avant 1.25 ne déclare aucun moteur : il est sur MariaDB, et sa
 * connexion est montrée telle quelle, sans formulaire — elle se règle sur le
 * serveur lui-même.
 */
export function DatabaseSection() {
  const { t } = useTranslation("adminServices");
  const status = useServicesStatus();
  const database = status.data?.database;
  const legacy = database?.engine === null;
  const frame = {
    id: "database",
    title: t("databaseTitle"),
    description: t(legacy ? "databaseDescriptionMariaDb" : "databaseDescription"),
  };

  if (!database) {
    return (
      <AdminSection {...frame}>
        {status.isError ? <SectionError onRetry={() => void status.refetch()} /> : <SectionSkeleton />}
      </AdminSection>
    );
  }
  return (
    <AdminSection {...frame} badges={<SectionBadges summary={summarizeDatabase(database)} />}>
      {legacy ? <MariaDbFacts database={database} /> : <SqliteFacts database={database} />}
    </AdminSection>
  );
}

interface Fact {
  label: string;
  value: string;
  /** Un chemin, une version : en chasse fixe. */
  mono?: boolean;
  /** Toute la largeur : un chemin ne tient pas dans une colonne. */
  wide?: boolean;
}

function Facts({ facts, columns }: { facts: Fact[]; columns: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-3 ${columns}`}>
      {facts.map(({ label, value, mono, wide }) => (
        <div key={label} className={`min-w-0 ${wide ? "col-span-full" : ""}`}>
          <dt className="text-xs text-content-tertiary">{label}</dt>
          <dd className={`mt-0.5 truncate text-sm text-content-primary ${mono ? "font-mono" : ""}`} title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SqliteFacts({ database }: { database: DatabaseService }) {
  const { t, i18n } = useTranslation("adminServices");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const size = database.sizeBytes;
  // Une base qui ne s'ouvre pas et un fichier vide : la taille ne dit rien.
  const sizeKnown = size !== null && (size > 0 || database.status === "connected");
  const facts: Fact[] = [
    { label: t("databaseEngine"), value: databaseEngineName(database.engine ?? "") || "—" },
    { label: t("databaseVersion"), value: database.version || "—", mono: true },
    { label: t("databaseSize"), value: sizeKnown ? formatBytes(size, locale) : "—" },
    { label: t("databasePath"), value: database.path || "—", mono: true, wide: true },
  ];
  return (
    <div className="space-y-4">
      <Facts facts={facts} columns="sm:grid-cols-3" />
      {database.status === "error" && (
        <AdminNotice tone="error" title={t("databaseErrorTitle")}>
          {database.error ? <span className="break-words font-mono text-xs">{database.error}</span> : t("databaseErrorLogs")}
        </AdminNotice>
      )}
      {database.storage === "network" && (
        <AdminNotice tone="warning" title={t("databaseNetworkTitle")}>{t("databaseNetwork")}</AdminNotice>
      )}
    </div>
  );
}

/** Serveur d'avant 1.25 : la connexion MariaDB en service, pour mémoire. */
function MariaDbFacts({ database }: { database: DatabaseService }) {
  const { t } = useTranslation("adminServices");
  const fields = database.fields;
  const facts: Fact[] = [
    { label: t("databaseHost"), value: fields?.host || "—", mono: true },
    { label: t("databasePort"), value: fields ? String(fields.port) : "—", mono: true },
    { label: t("databaseName"), value: fields?.database || "—", mono: true },
    { label: t("databaseUser"), value: fields?.user || "—", mono: true },
    { label: t("databaseVersion"), value: formatDatabaseVersion(database.version) || "—", mono: true },
  ];
  return (
    <div className="space-y-4">
      <Facts facts={facts} columns="sm:grid-cols-3 xl:grid-cols-5" />
      {database.pendingRestart && <AdminNotice tone="warning">{t("databasePending")}</AdminNotice>}
    </div>
  );
}
