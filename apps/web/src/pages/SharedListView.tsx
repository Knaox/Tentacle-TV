import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSharedListView, useJellyfinClient, useUserId, forgetAutoRetired } from "@tentacle-tv/api-client";
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

  // Un partage de LIKÉS se ré-importe vers les favoris du visiteur ; la
  // watchlist partagée garde son ajout historique vers « Ma liste ».
  const kind = data?.kind ?? "watchlist";
  const addMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.allSettled(
        ids.map((id) =>
          kind === "likes"
            ? client.fetch(`/Users/${userId}/FavoriteItems/${id}`, { method: "POST" })
            : client
                .fetch(`/Users/${userId}/Items/${id}/Rating?likes=true`, { method: "POST" })
                // Un ajout manuel comme un autre : une série sortie de Ma liste
                // d'elle-même ne doit plus y revenir toute seule.
                .then(() => forgetAutoRetired(id)),
        ),
      );
    },
    onSuccess: () => {
      setSelected(new Set());
      setAdded(true);
      qc.invalidateQueries({ queryKey: [kind === "likes" ? "favorites" : "watchlist"] });
    },
  });

  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="flex items-center justify-between px-4 py-4 md:px-12">
        <Link to="/" className="text-lg font-bold text-content-primary">Tentacle TV</Link>
      </header>

      <main className="px-4 pb-28 md:px-12">
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-line-strong border-t-content-primary" />
          </div>
        ) : isError || !data ? (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-content-primary">{t("common:shareLinkNotFound")}</p>
            <Link to="/" className="mt-3 text-sm font-medium text-[var(--brand-light)] hover:underline">
              {t("common:backHome", "Retour à l'accueil")}
            </Link>
          </div>
        ) : data.items.length === 0 ? (
          <>
            <SharedListHeader ownerUsername={data.ownerUsername} authed={authed} token={token} kind={kind} />
            <p className="mt-10 text-center text-content-tertiary">{t("common:emptyWatchlist")}</p>
          </>
        ) : (
          <>
            <SharedListHeader ownerUsername={data.ownerUsername} authed={authed} token={token} kind={kind} />
            {authed && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAdded(false);
                    const selectable = data.items.filter((i) => i.Id).map((i) => i.Id);
                    setSelected(
                      selected.size === selectable.length ? new Set() : new Set(selectable),
                    );
                  }}
                  className="rounded-full bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
                >
                  {selected.size > 0 && selected.size === data.items.filter((i) => i.Id).length ? t("common:deselectAll") : t("common:selectAll")}
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
