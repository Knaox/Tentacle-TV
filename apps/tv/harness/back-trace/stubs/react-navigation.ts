/**
 * Une doublure de @react-navigation/native pour le banc de traces : la portée
 * du Retour d'origine importe `railNavigate` (et sa référence de navigation)
 * pour la liste des pages du rail. Rien n'y est appelé.
 */

const bench = globalThis as unknown as { __calls: string[] };
bench.__calls ??= [];

export const CommonActions = {
  reset: (state: unknown) => ({ type: "RESET", payload: state }),
};

export function createNavigationContainerRef() {
  return {
    isReady: () => false,
    getRootState: () => undefined,
    getCurrentRoute: () => undefined,
    dispatch: () => bench.__calls.push("navigationRef.dispatch"),
    goBack: () => bench.__calls.push("navigationRef.goBack"),
    reset: () => bench.__calls.push("navigationRef.reset"),
  };
}
