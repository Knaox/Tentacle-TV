/**
 * Octave — la page suivante d'une liste, chargée à l'approche du bas (une
 * sentinelle observée), avec un bouton pour le clavier et les lecteurs d'écran.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface PagedQuery {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

export function LoadMore({ query }: { query: PagedQuery }) {
  const { t } = useTranslation("music");
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (!hasNextPage) return null;
  return (
    <div ref={sentinel} className="flex justify-center py-6">
      <button
        type="button"
        disabled={isFetchingNextPage}
        onClick={() => void fetchNextPage()}
        className="cursor-pointer rounded-full border border-line-subtle px-4 py-2 text-sm font-semibold text-content-secondary hover:text-content-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {t("library.more")}
      </button>
    </div>
  );
}
