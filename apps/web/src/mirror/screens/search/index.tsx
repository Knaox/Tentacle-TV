import "../../mirror.css";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CardSheetProvider } from "../../cards/CardSheetProvider";
import { useIsTablet } from "../../useMirrorLayout";
import { QuerySuggestions } from "./QuerySuggestions";
import { SearchBrowse } from "./SearchBrowse";
import { SearchField } from "./SearchField";
import { SearchFilters } from "./SearchFilters";
import { SearchHome } from "./SearchHome";
import { SearchResults } from "./SearchResults";
import { useMirrorSearch } from "./useMirrorSearch";

/**
 * Haut de l'en-tête. Sur iPhone, l'app pose la recherche en FEUILLE sous la
 * barre d'état : 16 au-dessus du champ. Sur tablette, plein écran :
 * `max(encoche, 24) + 12`. Ici l'écran est toujours plein cadre : la zone
 * sûre s'ajoute au téléphone pour retrouver la même distance sous la barre.
 */
const HEADER_TOP_PHONE = "calc(env(safe-area-inset-top, 0px) + 16px)";
const HEADER_TOP_TABLET = "calc(max(env(safe-area-inset-top, 0px), 24px) + 12px)";

/** `SubtleBackground ambient` : dégradé `s0 → s0Tint`, orbe violet de 320 en haut. */
const BACKGROUND = "linear-gradient(to bottom, var(--surface-0), var(--surface-0-tint))";
const AMBIENT = "linear-gradient(to bottom, rgba(var(--brand-rgb), 0.18) 0%, rgba(var(--brand-rgb), 0.04) 30%, transparent 70%)";

/**
 * `SearchScreen` de l'app, route `/search` — HORS de la coquille : ni en-tête
 * ni barre d'onglets, l'écran gère lui-même ses zones sûres. En-tête de verre
 * (champ 46, « Annuler » 15 semi-gras violet clair, filtres en pastilles), puis
 * un défilement : l'accueil de la recherche, les résultats, ou le parcours
 * d'une personne, d'un genre, d'un studio. Le champ prend le focus à
 * l'ouverture, sauf ouvert sur une filmographie ; le clavier se range dès
 * qu'on fait défiler du doigt. L'appui long d'une affiche ouvre la feuille
 * de ses actions (`CardSheetProvider`).
 */
export function MirrorSearch() {
  return (
    <CardSheetProvider>
      <SearchScreen />
    </CardSheetProvider>
  );
}

function SearchScreen() {
  const { t } = useTranslation("search");
  const isTablet = useIsTablet();
  const s = useMirrorSearch();
  const { nav } = s;
  const inputRef = useRef<HTMLInputElement>(null);
  const touching = useRef(false);

  useEffect(() => {
    // Une filmographie ouverte d'une fiche se lit : pas de clavier par-dessus.
    if (nav.openedOnBrowse.current) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [nav.openedOnBrowse]);

  // `keyboardDismissMode="on-drag"` : un défilement AU DOIGT range le clavier
  // (pas celui que provoque l'arrivée des résultats).
  const onScroll = useCallback(() => {
    if (touching.current && document.activeElement === inputRef.current) inputRef.current?.blur();
  }, []);
  const { pick } = s;
  const pickAndDismiss = useCallback((value: string) => {
    pick(value);
    inputRef.current?.blur();
  }, [pick]);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-surface-0"
      style={{
        background: BACKGROUND,
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80" style={{ background: AMBIENT }} />

      {/* Le verre de l'app (`GlassSurface` 28) sans son flou : rien ne défile
          sous cet en-tête, le flou n'aurait que le fond immobile à brouiller. */}
      <header
        className="relative shrink-0 border-b-[0.5px] border-line-subtle bg-glass-tint pb-3"
        style={{ paddingTop: isTablet ? HEADER_TOP_TABLET : HEADER_TOP_PHONE }}
      >
        <div className="mx-auto flex w-full max-w-[860px] items-center gap-2 px-4">
          <SearchField
            ref={inputRef}
            value={s.query}
            completion={s.completion}
            busy={s.busy}
            onChange={s.change}
            onSubmit={s.submit}
            onClear={() => s.pick("")}
            onFocusChange={s.setFocused}
          />
          <button
            type="button"
            onClick={nav.cancel}
            className="shrink-0 px-1 py-2 text-[15px] font-semibold tracking-[0.1px] text-brand-light active:opacity-70"
          >
            {t("cancel")}
          </button>
        </div>
        {s.searching && <SearchFilters options={s.filters} active={s.filter} onChange={s.setFilter} />}
      </header>

      <main
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 48px)" }}
        onScroll={onScroll}
        onTouchStart={() => { touching.current = true; }}
        onTouchEnd={() => { touching.current = false; }}
        onTouchCancel={() => { touching.current = false; }}
      >
        {s.browse !== null ? (
          <SearchBrowse
            target={s.browse}
            onBack={() => nav.closeBrowse(s.query)}
            onOpen={s.actions.openItem}
            onOpenExternal={s.actions.openExternalItem}
            onSeeAllExternal={s.actions.openExternal}
          />
        ) : s.debounced.length === 0 ? (
          <SearchHome
            recent={s.recents.recent}
            onPick={s.pick}
            onRemove={s.recents.remove}
            onClear={s.recents.clear}
            onGenre={s.openGenre}
            onOpen={s.openHomeItem}
          />
        ) : (
          <>
            {s.filter === "all" && <QuerySuggestions queries={s.suggestions} onPick={pickAndDismiss} />}
            <SearchResults
              query={s.debounced}
              response={s.response}
              episodes={s.episodes}
              external={s.external}
              filter={s.filter}
              onFilter={s.setFilter}
              onRetry={s.pick}
              actions={s.actions}
            />
          </>
        )}
      </main>
    </div>
  );
}
