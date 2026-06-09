import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSharedListView, useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { SharedListHeader } from "../components/share/SharedListHeader";
import { SharedListGrid } from "../components/share/SharedListGrid";
import { SharedListAddBar } from "../components/share/SharedListAddBar";

/**
 * Page PUBLIQUE d'une liste partagée (/share/:token).
 * Lecture seule si non connecté ; sélection + ajout à sa liste si connecté.
 */
export function SharedListView() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation("common");
  const { data, isLoading, isError } = useSharedListView(token);

  const authed = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_user");
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);

  const toggle = useCallback((id: string) => {
    setAdded(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.allSettled(
        ids.map((id) => client.fetch(`/Users/${userId}/Items/${id}/Rating?likes=true`, { method: "POST" })),
      );
    },
    onSuccess: () => {
      setSelected(new Set());
      setAdded(true);
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="flex items-center justify-between px-4 py-4 md:px-12">
        <Link to="/" className="text-lg font-bold text-white">Tentacle TV</Link>
      </header>

      <main className="px-4 pb-28 md:px-12">
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-white" />
          </div>
        ) : isError || !data ? (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-white">{t("common:shareLinkNotFound")}</p>
            <Link to="/" className="mt-3 text-sm font-medium text-[var(--brand-light)] hover:underline">
              {t("common:backHome", "Retour à l'accueil")}
            </Link>
          </div>
        ) : data.items.length === 0 ? (
          <>
            <SharedListHeader ownerUsername={data.ownerUsername} authed={authed} token={token} />
            <p className="mt-10 text-center text-white/50">{t("common:emptyWatchlist")}</p>
          </>
        ) : (
          <>
            <SharedListHeader ownerUsername={data.ownerUsername} authed={authed} token={token} />
            {authed && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAdded(false);
                    setSelected(
                      selected.size === data.items.length
                        ? new Set()
                        : new Set(data.items.map((i) => i.Id)),
                    );
                  }}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {selected.size === data.items.length ? t("common:deselectAll") : t("common:selectAll")}
                </button>
              </div>
            )}
            <SharedListGrid items={data.items} authed={authed} selected={selected} onToggle={toggle} token={token} />
            {authed && (
              <SharedListAddBar
                count={selected.size}
                isAdding={addMut.isPending}
                added={added}
                onAdd={() => addMut.mutate([...selected])}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
