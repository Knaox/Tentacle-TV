import type { ThemeMode } from "@tentacle-tv/theme";

/**
 * L'APERÇU d'un thème, sous son nom : une fenêtre en réduction — la page, un panneau, deux
 * lignes de texte, la touche d'accent. « Système » en montre les deux moitiés. Les encres sont
 * celles des jetons de CHAQUE thème (`theme/tokens.css`), écrites en dur : un aperçu du thème
 * clair doit rester clair quand l'application est en sombre.
 */

const INKS = {
  light: { page: "#F3F2EF", panel: "#FFFFFF", text: "#131315", soft: "rgba(19, 19, 21, 0.22)", accent: "#A21CAF" },
  dark: { page: "#0B0B0C", panel: "#1B1B1E", text: "#F4F2EE", soft: "rgba(244, 242, 238, 0.24)", accent: "#E58CF0" },
} as const;

function Half({ scheme }: { scheme: keyof typeof INKS }) {
  const ink = INKS[scheme];
  return (
    <span className="relative block h-full min-w-0 flex-1" style={{ background: ink.page }}>
      <i className="absolute inset-x-2.5 bottom-0 top-2.5 rounded-t-md" style={{ background: ink.panel }} />
      <i className="absolute left-5 top-5 h-1 w-8 rounded-full" style={{ background: ink.text }} />
      <i className="absolute left-5 top-8 h-1 w-14 max-w-[55%] rounded-full" style={{ background: ink.soft }} />
      <i className="absolute right-5 top-[18px] h-2 w-4 rounded-full" style={{ background: ink.accent }} />
    </span>
  );
}

export function ThemeMini({ mode }: { mode: ThemeMode }) {
  return (
    <span aria-hidden className="mt-2 flex h-14 overflow-hidden rounded-lg shadow-edge">
      {mode === "auto" ? <><Half scheme="light" /><Half scheme="dark" /></> : <Half scheme={mode} />}
    </span>
  );
}
