import { createElement, Fragment, useMemo, type ReactNode } from "react";
import { resolveServerCapabilities, type ServerCapability } from "@tentacle-tv/shared";
import { useAppConfig } from "./useConfig";

/**
 * Les capacités du serveur courant — la SEULE porte par laquelle un client
 * décide de montrer une fonction qui dépend du serveur (`serverCapabilities.ts`,
 * shared). Lues dans `/api/config` (la requête `["app-config"]`, déjà en cache
 * pour la Famille et la version) : aucune requête de plus.
 *
 * Tant que la configuration n'a pas répondu, ou si elle échoue : aucune
 * capacité. Une fonction récente n'apparaît qu'une fois prouvée — jamais
 * montrée puis retirée, jamais une erreur face à un serveur d'avant.
 */
export interface ServerCapabilitiesState {
  capabilities: ReadonlySet<ServerCapability>;
  /** La configuration a répondu (ou échoué) : l'absence d'une clé est un fait. */
  settled: boolean;
  /** La configuration a RÉPONDU : la liste vient du serveur (pas d'un échec réseau). */
  known: boolean;
}

export function useServerCapabilities(): ServerCapabilitiesState {
  const { data, isPending } = useAppConfig();
  const capabilities = useMemo(() => resolveServerCapabilities(data), [data]);
  return { capabilities, settled: !isPending, known: data !== undefined };
}

/** Le serveur sait-il faire `capability` ? `false` tant que ce n'est pas prouvé. */
export function useServerCapability(capability: ServerCapability): boolean {
  return useServerCapabilities().capabilities.has(capability);
}

export interface ServerCapabilityGateProps {
  capability: ServerCapability;
  children?: ReactNode;
  /** Ce qui se rend quand le serveur ne la déclare pas (le comportement d'avant,
   *  une redirection) — rien par défaut. */
  fallback?: ReactNode;
}

/**
 * Le composant de garde : rend `children` seulement si le serveur déclare la
 * capacité, `fallback` une fois l'absence établie, et RIEN tant que la
 * configuration n'a pas répondu (ni l'un ni l'autre ne clignote). Sans DOM ni
 * vue native — le même pour le web, le mobile et la TV.
 */
export function ServerCapabilityGate({ capability, children, fallback = null }: ServerCapabilityGateProps) {
  const { capabilities, settled } = useServerCapabilities();
  if (capabilities.has(capability)) return createElement(Fragment, null, children);
  return settled ? createElement(Fragment, null, fallback) : null;
}
