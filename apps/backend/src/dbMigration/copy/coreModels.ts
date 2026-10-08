import { Prisma } from "@prisma/client";

/**
 * Les tables du CŒUR telles que le client Prisma les connaît (DMMF) : nom réel de
 * la table, colonnes, types, défauts. C'est la même source que les migrations du
 * socle (`schema.prisma`) : la copie ne peut pas dériver d'elles.
 *
 * Lire le DMMF ne crée AUCUN client Prisma (aucune connexion, aucun moteur).
 */
export interface CoreField {
  column: string;
  /** Type scalaire Prisma : String, Int, Float, Boolean, DateTime… */
  type: string;
  required: boolean;
  /** Défaut du modèle : une valeur littérale, ou `{ name: "now" | "cuid" | … }`. */
  default?: unknown;
  updatedAt: boolean;
}

export interface CoreModel {
  table: string;
  fields: CoreField[];
}

interface DmmfField {
  name: string;
  dbName?: string | null;
  kind: string;
  type: string;
  isRequired: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  isUpdatedAt?: boolean;
}

interface DmmfModel {
  name: string;
  dbName?: string | null;
  fields: readonly DmmfField[];
}

export function coreModelsFrom(models: readonly DmmfModel[]): CoreModel[] {
  return models.map((m) => ({
    table: m.dbName ?? m.name,
    fields: m.fields
      .filter((f) => f.kind === "scalar" || f.kind === "enum")
      .map((f) => ({
        column: f.dbName ?? f.name,
        type: f.type,
        required: f.isRequired,
        default: f.hasDefaultValue ? f.default : undefined,
        updatedAt: !!f.isUpdatedAt,
      })),
  }));
}

/** Les modèles du client généré (celui de l'image : provider sqlite). */
export function coreModels(): CoreModel[] {
  return coreModelsFrom(Prisma.dmmf.datamodel.models as unknown as DmmfModel[]);
}
