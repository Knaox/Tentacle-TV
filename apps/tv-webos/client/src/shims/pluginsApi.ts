import { createElement, type ReactNode, type ReactElement } from "react";

/**
 * Le système de plugins, absent.
 *
 * Sur le web, les plugins sont chargés à l'exécution : le client interroge
 * `/api/plugins/active`, puis monte chaque bundle dans une iframe bac à sable.
 * Rien n'en traverse le bundler — l'exclure tient donc en un module inerte.
 *
 * Les six fichiers d'`apps/web` qui en dépendent continuent d'appeler ces
 * fonctions ; elles répondent « aucun plugin », et les routes comme les entrées
 * de navigation qui en dériveraient ne sont jamais produites.
 */

export interface ActivePluginMeta {
  id: string;
  version: string;
  navItems?: unknown[];
}

const NONE: readonly ActivePluginMeta[] = Object.freeze([]);

export function PluginProvider(props: { children?: ReactNode }): ReactElement {
  return createElement("div", { style: { display: "contents" } }, props.children);
}

export function useActivePluginsMeta(): readonly ActivePluginMeta[] {
  return NONE;
}

export function useRefreshPlugins(): () => void {
  return refresh;
}

export function usePlugins(): readonly ActivePluginMeta[] {
  return NONE;
}

export function usePluginNavItems(): readonly unknown[] {
  return NONE;
}

export function usePluginAdminNavItems(): readonly unknown[] {
  return NONE;
}

export function usePluginRoutes(): readonly unknown[] {
  return NONE;
}

export function usePluginAdminRoutes(): readonly unknown[] {
  return NONE;
}

export function usePlugin(): null {
  return null;
}

export function usePluginEnabled(): boolean {
  return false;
}

export function registerPlugin(): void {
  /* Aucun registre : rien à enregistrer. */
}

export function unregisterPlugin(): void {
  /* Idem. */
}

/** Référence stable : la passer en dépendance d'effet ne doit rien relancer. */
function refresh(): void {
  /* Aucun plugin à recharger. */
}
