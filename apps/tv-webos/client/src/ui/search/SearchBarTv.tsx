import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Search } from "lucide-react";

/**
 * La barre de recherche : ce qui est tapé, en blanc ; la suite du meilleur
 * résultat, en gris ; un curseur entre les deux. Elle dit toujours où l'on en
 * est, même quand le focus est trois rangées plus bas.
 *
 * **Rien n'est codé pour le clavier.** webOS ouvre le sien dès qu'un `<input>`
 * reçoit le focus, et le referme à la validation ; c'est aussi ce clavier qui
 * porte le micro de la Magic Remote. `com.webos.service.tts` est de la
 * SYNTHÈSE vocale, et webOS n'expose aucune reconnaissance aux applications
 * tierces : le clavier système est le seul chemin de dictée, le même verdict
 * que sur tvOS.
 *
 * **Deux éléments là où il n'y en avait qu'un, et c'est tout le correctif.**
 * Tant que la barre ÉTAIT le champ, la simple navigation au D-pad faisait
 * monter un clavier plein écran que personne n'avait demandé. La barre est
 * donc un bouton — focalisable, jamais éditable — et le champ véritable est
 * retiré du parcours (`tabIndex={-1}`) et posé par-dessus, transparent : webOS
 * ancre son clavier sur la position du champ focalisé. Le clavier ne monte
 * plus qu'au geste qui le demande : OK sur la barre.
 */

/**
 * Délai de grâce avant de rendre la main à la barre quand le clavier se retire.
 *
 * La dictée fait passer `visibility` par faux AVANT de revenir à vrai — le
 * clavier s'efface pendant que l'interface vocale s'affiche. Rendre le focus
 * sur-le-champ casserait la saisie vocale, la seule que cette plateforme offre.
 */
const BAR_RETURN_DELAY_MS = 450;

function onTv(): boolean {
  return typeof (window as unknown as { PalmSystem?: unknown }).PalmSystem !== "undefined";
}

export interface SearchBarHandle {
  /** Pose le focus sur la barre — jamais sur le champ, qui ferait monter le clavier. */
  focusBar: () => void;
  /** Fait redescendre le clavier : un champ démonté ne suffit pas (Simulator webOS 26). */
  blurField: () => void;
}

interface SearchBarTvProps {
  query: string;
  /** La suite grisée du meilleur résultat (« Aube » → « des Titans… »). */
  completion: string | null;
  onChange: (query: string) => void;
}

export const SearchBarTv = forwardRef<SearchBarHandle, SearchBarTvProps>(function SearchBarTv(
  { query, completion, onChange },
  handle,
) {
  const { t } = useTranslation(["search", "common"]);
  const bar = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useImperativeHandle(handle, () => ({
    focusBar: () => bar.current?.focus(),
    blurField: () => field.current?.blur(),
  }), []);

  // OK sur la barre : LE geste qui ouvre le clavier, et le seul. Idempotent :
  // si le champ a déjà le focus, le clavier est déjà là.
  const openKeyboard = useCallback(() => field.current?.focus(), []);

  // Le clavier se retire : la barre reprend le focus. Sans cela il resterait
  // sur un champ invisible, hors du parcours — plus d'anneau, plus de point de
  // départ pour les flèches. Un retour à vrai dans l'intervalle annule tout.
  useEffect(() => {
    let back: ReturnType<typeof setTimeout> | undefined;
    const onKeyboard = (event: Event) => {
      const detail = (event as CustomEvent<{ visibility?: boolean }>).detail;
      if (detail?.visibility === true) {
        clearTimeout(back);
        return;
      }
      back = setTimeout(() => {
        if (document.activeElement === field.current) bar.current?.focus();
      }, BAR_RETURN_DELAY_MS);
    };
    document.addEventListener("keyboardStateChange", onKeyboard);
    return () => {
      document.removeEventListener("keyboardStateChange", onKeyboard);
      clearTimeout(back);
    };
  }, []);

  const typed = query.length > 0;

  return (
    <div className="tv-search-bar">
      {/* La cible du D-pad : un bouton, donc rien que webOS puisse prendre pour
          une demande de saisie. Le moteur active une cible par `click()`. */}
      <button
        ref={bar}
        type="button"
        className="tv-search-bar-button"
        data-typed={typed}
        onClick={openKeyboard}
        aria-label={query || t("search:launcher")}
      >
        <Search className="tv-search-bar-icon" size={30} strokeWidth={2} aria-hidden />
        <span className="tv-search-bar-text">
          {typed ? (
            <>
              {query}
              <span className="tv-search-bar-caret" aria-hidden>|</span>
              {completion && <span className="tv-search-bar-completion">{completion}</span>}
            </>
          ) : (
            <span className="tv-search-bar-placeholder">{t("search:launcher")}</span>
          )}
        </span>
        {onTv() && <Mic className="tv-search-bar-mic" size={26} strokeWidth={2} aria-hidden />}
      </button>
      {/* Le champ véritable, posé par-dessus la barre et transparent. Il porte
          la saisie et reçoit la dictée ; `tabIndex={-1}` le retire du
          recensement du moteur, donc aucune flèche ne peut l'atteindre. */}
      <input
        ref={field}
        tabIndex={-1}
        value={query}
        onChange={(event) => onChange(event.target.value)}
        className="tv-search-bar-field"
        autoComplete="off"
        spellCheck={false}
        aria-hidden="true"
      />
    </div>
  );
});

/** L'indice de dictée — seulement sur une vraie dalle, où le micro existe. */
export function DictationHint() {
  const { t } = useTranslation("common");
  if (!onTv()) return null;
  return <p className="tv-search-hint">{t("common:rechercheTvDictee")}</p>;
}
