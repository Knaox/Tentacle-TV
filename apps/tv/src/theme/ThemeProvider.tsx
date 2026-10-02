import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_THEME, type Theme } from "@tentacle-tv/theme";

export interface ThemeContextValue {
  theme: Theme;
}

/**
 * Le thème de la TV est CONSTANT : celui du code (`DEFAULT_THEME`).
 *
 * Il venait autrefois de `/api/theme`, que l'administrateur pouvait surcharger
 * — c'est par là que les presets saisonniers (Noël, Pâques, Halloween)
 * décalaient les couleurs de la TV. Presets et surcharge ont quitté le serveur
 * (1.17, qui sert depuis un état constant) : la TV ne lit plus la route, et un
 * serveur plus ancien resté sur un preset ne la teinte plus.
 */
const VALUE: ThemeContextValue = { theme: DEFAULT_THEME };

const ThemeContext = createContext<ThemeContextValue>(VALUE);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { ThemeContext };
