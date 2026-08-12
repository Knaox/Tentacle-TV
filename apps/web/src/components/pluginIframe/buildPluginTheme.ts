// Thème de l'iframe plugin : config du runtime Tailwind + bloc <style>.
// CSS tokens du host injectés dans l'iframe pour que les plugins suivent
// automatiquement le thème (couleurs, blur, shadows, radii, motion). Si
// Tentacle change ses tokens.css, les plugins suivent au prochain rebuild —
// pas de couleurs hardcodées côté plugin.
import tentacleTokensCss from "../../theme/tokens.css?inline";
import tentacleMotionReduceCss from "../../theme/motion-reduce.css?inline";

/**
 * Script `tailwind.config = …` du runtime Tailwind de l'iframe (sans balises
 * <script>). Couleurs sémantiques mappées sur les CSS variables Tentacle :
 * bg-tentacle-surface-1 / text-tentacle-brand / border-tentacle-subtle…
 * plutôt que des classes hardcodées — si le thème change, le plugin suit.
 */
export function buildPluginTailwindConfigScript(): string {
  return `
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            // Inversion pilotee par schema : white/black deviennent des canaux
            // RGB variables. Le format rgb(var / <alpha-value>) est requis pour
            // que les modificateurs d'opacite Tailwind (white/70, black/40)
            // continuent de composer. NB : pas de backtick dans ce commentaire,
            // on est DANS le template literal du srcdoc.
            white: "rgb(var(--plugin-white-rgb) / <alpha-value>)",
            black: "rgb(var(--plugin-black-rgb) / <alpha-value>)",
            tentacle: {
              "surface-0": "var(--surface-0)",
              "surface-1": "var(--surface-1)",
              "surface-2": "var(--surface-2)",
              "surface-3": "var(--surface-3)",
              "surface-modal": "var(--surface-modal)",
              "surface-dropdown": "var(--surface-dropdown)",
              "surface-toolbar": "var(--surface-toolbar)",
              brand: "var(--brand)",
              "brand-light": "var(--brand-light)",
              "brand-dark": "var(--brand-dark)",
              "brand-accent": "var(--brand-accent)",
              "brand-soft": "var(--brand-soft)",
              "text-primary": "var(--text-primary)",
              "text-secondary": "var(--text-secondary)",
              "text-tertiary": "var(--text-tertiary)",
              "text-quaternary": "var(--text-quaternary)",
              "text-disabled": "var(--text-disabled)",
              "cta-primary": "var(--cta-primary-bg)",
              "cta-primary-fg": "var(--cta-primary-fg)",
              "cta-secondary": "var(--cta-secondary-bg)",
              "cta-secondary-fg": "var(--cta-secondary-fg)",
              "cta-ghost": "var(--cta-ghost-bg)",
              "cta-brand-fg": "var(--cta-brand-fg)",
              "border-subtle": "var(--border-subtle)",
              "border-strong": "var(--border-strong)",
              "border-focus": "var(--border-focus)",
              "status-success": "var(--status-success)",
              "status-success-bg": "var(--status-success-bg)",
              "status-success-fg": "var(--status-success-fg)",
              "status-warning": "var(--status-warning)",
              "status-warning-bg": "var(--status-warning-bg)",
              "status-warning-fg": "var(--status-warning-fg)",
              "status-error": "var(--status-error)",
              "status-error-bg": "var(--status-error-bg)",
              "status-error-fg": "var(--status-error-fg)",
              "status-info": "var(--status-info)",
              "status-info-bg": "var(--status-info-bg)",
              "status-info-fg": "var(--status-info-fg)",
              "fill-faint": "var(--fill-faint)",
              "fill-subtle": "var(--fill-subtle)",
              "fill-soft": "var(--fill-soft)",
              "fill-medium": "var(--fill-medium)",
              "fill-strong": "var(--fill-strong)",
              "fill-shimmer": "var(--fill-shimmer)",
              // Texte pose sur une affiche/backdrop — constant entre schemas
              // (blanc + assise sombre), cf. tokens on-media du host.
              "on-media-primary": "var(--on-media-primary)",
              "on-media-secondary": "var(--on-media-secondary)",
              "on-media-muted": "var(--on-media-muted)",
              // Aliases rétro-compatibilité (anciens plugins)
              bg: "var(--surface-0)",
              surface: "var(--surface-1)",
              border: "var(--border-subtle)",
              accent: "var(--brand)",
              "accent-dark": "var(--brand-dark)",
              "accent-light": "var(--brand-light)",
              "accent-muted": "var(--brand-light)",
            },
          },
          borderRadius: {
            "tentacle-xs": "var(--radius-xs)",
            "tentacle-sm": "var(--radius-sm)",
            "tentacle-md": "var(--radius-md)",
            "tentacle-lg": "var(--radius-lg)",
            "tentacle-xl": "var(--radius-xl)",
            "tentacle-pill": "var(--radius-pill)",
          },
          boxShadow: {
            "tentacle-elev-1": "var(--elev-1)",
            "tentacle-elev-2": "var(--elev-2)",
            "tentacle-elev-3": "var(--elev-3)",
            "tentacle-modal": "var(--shadow-modal)",
            "tentacle-dropdown": "var(--shadow-dropdown)",
            "tentacle-sheet": "var(--shadow-sheet)",
          },
          backdropBlur: {
            "tentacle-overlay": "var(--blur-overlay)",
            "tentacle-modal": "var(--blur-modal)",
            "tentacle-dropdown": "var(--blur-dropdown)",
            "tentacle-sheet": "var(--blur-sheet)",
          },
          transitionTimingFunction: {
            "tentacle-out": "var(--ease-out)",
            "tentacle-in-out": "var(--ease-in-out)",
            "tentacle-spring": "var(--ease-spring)",
          },
          transitionDuration: {
            "tentacle-instant": "var(--duration-instant)",
            "tentacle-fast": "var(--duration-fast)",
            "tentacle-base": "var(--duration-base)",
            "tentacle-slow": "var(--duration-slow)",
          },
          animation: {
            shimmer: "shimmer 1.5s ease infinite",
            "fade-slide-up": "fadeSlideUp 0.5s ease both",
            "fade-slide-down": "fadeSlideDown 0.3s ease both",
            "scale-in": "scaleIn 0.2s ease both",
            "slide-in-right": "slideInRight 0.25s ease both",
            "pulse-glow": "pulseGlow 2s ease infinite",
            breathe: "breathe 2s ease infinite",
          },
          keyframes: {
            shimmer: {
              "0%": { backgroundPosition: "-200% 0" },
              "100%": { backgroundPosition: "200% 0" },
            },
            fadeSlideUp: {
              from: { opacity: "0", transform: "translateY(20px)" },
              to: { opacity: "1", transform: "translateY(0)" },
            },
            fadeSlideDown: {
              from: { opacity: "0", transform: "translateY(-10px)" },
              to: { opacity: "1", transform: "translateY(0)" },
            },
            scaleIn: {
              from: { opacity: "0", transform: "scale(0.95)" },
              to: { opacity: "1", transform: "scale(1)" },
            },
            slideInRight: {
              from: { opacity: "0", transform: "translateX(30px)" },
              to: { opacity: "1", transform: "translateX(0)" },
            },
            pulseGlow: {
              "0%, 100%": { opacity: "0.4" },
              "50%": { opacity: "0.8" },
            },
            breathe: {
              "0%, 100%": { boxShadow: "0 0 15px rgba(139,92,246,0.3)" },
              "50%": { boxShadow: "0 0 25px rgba(139,92,246,0.5)" },
            },
          },
        },
      },
    };
  `;
}

/**
 * Contenu du bloc <style> de l'iframe (sans balises) : tokens du host,
 * politique reduced-motion, aliases rétro-compat, inversion white/black,
 * base + états de chargement/erreur + scrollbar.
 */
export function buildPluginThemeStyle(): string {
  return `
    /* Inter, la police de l'application. Sans cet import, l'iframe retombait sur
       la police système : le texte d'un plugin ne ressemblait à rien de ce qui
       l'entoure, sur chaque mot de chaque écran. C'est le plus gros écart visuel
       entre une page de plugin et le reste de Tentacle TV.
       L'origine est déjà autorisée par la CSP de la page (style-src
       fonts.googleapis.com, font-src fonts.gstatic.com), dont l'iframe hérite. */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    /* Tokens du host Tentacle — copiés depuis apps/web/src/theme/tokens.css à chaque build.
       Tout plugin peut désormais utiliser var(--brand), var(--surface-1), etc. */
    ${tentacleTokensCss}
    /* Politique prefers-reduced-motion du host (durées à zéro, etc.). */
    ${tentacleMotionReduceCss}
    /* Aliases rétro-compatibilité pour anciens plugins */
    :root {
      --bg: var(--surface-0);
      --surface: var(--surface-1);
      --accent: var(--brand);
      --text: var(--text-primary);
    }
    /* Canaux RGB des couleurs white/black du runtime Tailwind du plugin.
       Les bundles (Seer) sont ecrits sombre-only avec text-white/bg-black en
       dur : en clair on INVERSE les deux canaux, et comme la config Tailwind
       les consomme en rgb(var / alpha), tous les modificateurs d'opacite du
       plugin (white/70, black/40...) continuent de composer normalement. */
    :root {
      --plugin-white-rgb: 255 255 255;
      --plugin-black-rgb: 0 0 0;
    }
    :root[data-theme="light"] {
      --plugin-white-rgb: 11 11 16;
      --plugin-black-rgb: 255 255 255;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--surface-0);
      color: var(--text-primary);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      /* Mêmes réglages que l'application : chiffres mieux dessinés et 'a'
         alternatif. Précieux dans un calendrier, où les nombres s'alignent. */
      font-feature-settings: "ss01", "cv11";
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #plugin-root { min-height: 100vh; }
    .plugin-loading {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 24px;
      min-height: 100vh;
      color: var(--text-secondary);
      font-size: 14px;
    }
    .plugin-loading .logo-wrap {
      position: relative;
      animation: breathe-logo 2s ease infinite;
    }
    .plugin-loading .logo-wrap img { width: 64px; height: 64px; filter: drop-shadow(0 0 20px rgba(139,92,246,0.5)); }
    .plugin-loading .spinner {
      position: absolute; inset: -12px;
      border: 2px solid transparent;
      border-top-color: rgba(139,92,246,0.6);
      border-radius: 50%;
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes breathe-logo { 0%,100% { opacity: .8; } 50% { opacity: 1; } }
    .plugin-error {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-height: 100vh;
      color: #ef4444;
      font-size: 14px;
      padding: 24px;
      text-align: center;
    }
    /* Scrollbar Tentacle — fine et violette */
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 3px; }
    *::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }
    * { scrollbar-width: thin; scrollbar-color: rgba(139, 92, 246, 0.3) transparent; }
  `;
}
