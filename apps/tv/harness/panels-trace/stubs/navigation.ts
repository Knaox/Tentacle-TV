import { note } from "./record";

/**
 * Une doublure de @react-navigation/native : la navigation note ce qu'on lui
 * demande ; l'écran est toujours devant.
 */

const navigation = {
  navigate: (name: string, params?: unknown) => note({ navigate: name, params }),
  goBack: () => note({ goBack: true }),
  canGoBack: () => true,
  dispatch: (action: unknown) => note({ dispatch: action }),
  push: (name: string, params?: unknown) => note({ push: name, params }),
  replace: (name: string, params?: unknown) => note({ replace: name, params }),
  getState: () => ({ routes: [{ name: "Home" }], index: 0 }),
  addListener: () => () => {},
};

export const useNavigation = () => navigation;
export const useIsFocused = () => true;
export const useRoute = () => ({ name: "Home", params: {} });
export const useFocusEffect = () => {};
export const CommonActions = { reset: (state: unknown) => ({ type: "RESET", payload: state }) };
export const StackActions = { replace: (name: string, params?: unknown) => ({ type: "REPLACE", payload: { name, params } }) };
export function createNavigationContainerRef() {
  return { isReady: () => false, getRootState: () => undefined, getCurrentRoute: () => undefined, dispatch() {}, goBack() {}, reset() {} };
}
