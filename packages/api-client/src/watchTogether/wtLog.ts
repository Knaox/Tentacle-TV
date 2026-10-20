/**
 * Le journal de diagnostic Watch Together, injecté par la plateforme : le web
 * y branche son `wtLog` (console, en développement seulement), le mobile ce
 * qu'il veut. Sans branchement, rien ne s'écrit — jamais en production.
 */

export type WtLogger = (scope: string, message: string, data?: unknown) => void;

let logger: WtLogger | null = null;

export function setWtLogger(next: WtLogger | null): void {
  logger = next;
}

export function wtLog(scope: string, message: string, data?: unknown): void {
  logger?.(scope, message, data);
}
