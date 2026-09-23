/**
 * L'OMNIBOX — la barre de recherche de Tentacle, ouverte par ⌘K, « / » ou la
 * barre de navigation.
 *
 * Tout se fait au clavier sans quitter le champ : ↑↓ parcourent TOUT (meilleur
 * résultat, titres, personnes, épisodes, pastilles), ↵ ouvre, ⇥ ou → accepte
 * la complétion, ⌘↵ ouvre la page de tous les résultats, Échap ferme. La
 * première option est présélectionnée dès qu'on cherche : taper « interst »
 * puis ↵ ouvre Interstellar.
 *
 * Une garde contre la frappe plus rapide que le réseau : si la réponse
 * affichée n'est pas encore celle de ce qui est tapé, ↵ n'ouvre pas le premier
 * résultat de la requête d'avant — il cherche la saisie entière.
 *
 * Posée au-dessus de tout, SANS `backdrop-filter` sur le panneau : son fond
 * est opaque à 0,96, le flou n'y serait pas visible (CLAUDE.md, « Coût GPU »).
 * Le voile, lui, floute la page — immobile tant que l'omnibox est ouverte.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { inlineCompletion } from "@tentacle-tv/shared";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { easeOut } from "../../../theme/motion";
import { optionPath, stepIndex } from "../omniboxModel";
import { pushRecentSearch } from "../recentSearches";
import { OmniboxFooter } from "./OmniboxFooter";
import { OmniboxInput } from "./OmniboxInput";
import { OmniboxList } from "./OmniboxList";
import { OmniboxNotice } from "./OmniboxNotice";
import { optionId } from "./OmniboxRows";
import { useOmniboxData } from "./useOmniboxData";

export function Omnibox({ seed, onClose }: { seed: string; onClose: () => void }) {
  const { t } = useTranslation("search");
  const navigate = useNavigate();
  const compact = useIsMobile();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(seed);
  const [active, setActive] = useState(-1);
  const data = useOmniboxData(query);
  const { options } = data;

  // Une liste neuve : la première option est prête pour ↵ quand on cherche ;
  // barre vide, rien n'est présélectionné.
  useEffect(() => {
    setActive(data.debounced === "" || options.length === 0 ? -1 : 0);
  }, [options, data.debounced]);

  // Le focus au champ, puis rendu à ce qui l'avait à la fermeture.
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const remember = useCallback(() => {
    if (query.trim() !== "") pushRecentSearch(query);
  }, [query]);

  const go = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  const allResults = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed === "") return;
    remember();
    go(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [query, remember, go]);

  const activate = useCallback((index: number) => {
    const option = options[index];
    if (option === undefined) return;
    if (option.target.type === "recent") {
      setQuery(option.target.query);
      inputRef.current?.focus();
      return;
    }
    const path = optionPath(option.target);
    if (path === null) return;
    remember();
    go(path);
  }, [options, remember, go]);

  const play = useCallback((id: string) => {
    remember();
    go(`/watch/${id}`);
  }, [remember, go]);

  const top = data.response?.top ?? null;
  const completion = data.current && top !== null
    ? inlineCompletion(query, top.kind === "item" ? top.hit.item.Name : top.hit.name)
    : null;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => stepIndex(i, e.key === "ArrowDown" ? 1 : -1, options.length));
        return;
      case "Escape":
        e.preventDefault();
        onClose();
        return;
      case "Tab":
      case "ArrowRight": {
        const atEnd = e.currentTarget.selectionStart === query.length;
        if (completion !== null && atEnd && !e.shiftKey) {
          e.preventDefault();
          setQuery(query + completion);
          return;
        }
        // Le focus reste dans le dialogue : la liste se pilote d'ici.
        if (e.key === "Tab") e.preventDefault();
        return;
      }
      case "Enter":
        e.preventDefault();
        if (e.metaKey || e.ctrlKey || (query.trim() !== "" && !data.current)) allResults();
        else if (active >= 0) activate(active);
        else allResults();
        return;
    }
  };

  const empty = options.every((o) => o.section === "all");

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[rgba(var(--scrim-page-rgb),0.62)] backdrop-blur-[6px]"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: easeOut }}
        onMouseDown={onClose}
      />
      <div
        className={compact ? "absolute inset-0 flex" : "pointer-events-none absolute inset-x-0 flex justify-center px-3"}
        style={compact ? undefined : { top: "calc(var(--hote-bandeau) + 10px)" }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t("dialog")}
          className={compact
            ? "flex h-[100dvh] w-full flex-col bg-surface-modal"
            : "pointer-events-auto flex max-h-[min(78vh,720px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] border border-line-subtle bg-surface-modal shadow-[var(--shadow-modal)]"}
          initial={reduced ? false : { opacity: 0, y: -10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: easeOut }}
        >
          <OmniboxInput
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onKeyDown={onKeyDown}
            completion={completion}
            activeDescendant={active >= 0 ? optionId(active) : undefined}
            expanded={options.length > 0}
            fetching={data.fetching}
            onClose={onClose}
            compact={compact}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <OmniboxNotice
              query={query}
              response={data.response}
              current={data.current}
              pending={data.pending}
              empty={empty}
              externalPending={data.externalPending}
              onPick={setQuery}
            />
            <div id="omnibox-listbox" role="listbox" aria-label={t("dialog")}>
              <OmniboxList
                options={options}
                activeIndex={active}
                terms={data.terms}
                response={data.response}
                onHover={setActive}
                onActivate={activate}
                onPlay={play}
                onRemoveRecent={data.removeRecent}
                onClearRecents={data.clearRecents}
              />
            </div>
          </div>
          {!compact && (
            <OmniboxFooter tookMs={data.current ? data.response?.tookMs : undefined} hasQuery={query.trim() !== ""} canComplete={completion !== null} />
          )}
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}
