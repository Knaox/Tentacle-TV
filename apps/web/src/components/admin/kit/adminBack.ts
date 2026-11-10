import { createContext, useContext } from "react";

/**
 * Ce que fait le bouton RETOUR d'une page d'administration quand il a mieux à faire que
 * l'historique : fenêtre étroite (le rail seul, puis la page seule), il ramène à la vue
 * d'ensemble. Posé par la coquille (`AdminLayout`) ; absent, Retour revient d'où l'on vient.
 */
export const AdminBackCtx = createContext<(() => void) | undefined>(undefined);

export function useAdminBack(): (() => void) | undefined {
  return useContext(AdminBackCtx);
}
