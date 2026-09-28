import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSharedListView, useJellyfinClient, useUserId, forgetAutoRetired } from "@tentacle-tv/api-client";
import { ShareShell } from "../components/share/ShareShell";
import { SharedListHeader } from "../components/share/SharedListHeader";
import { ShareJoinCard } from "../components/share/ShareJoinCard";
import { SharedListGrid } from "../components/share/SharedListGrid";
import { SharedListAddBar } from "../components/share/SharedListAddBar";
import { ShareError, ShareListEmpty, ShareListSkeleton } from "../components/share/ShareStates";
import { summarizeSharedList } from "../components/share/shareSummary";
import { useShareVisitor } from "../components/share/useShareVisitor";

/**
 * Page PUBLIQUE d'une liste partagée (/share/:token) — Ma liste ou titres
 * likés. Le visiteur sans compte voit ce qu'on lui partage et comment
 * rejoindre le serveur ; connecté, il coche des titres et les ajoute à sa
 * propre liste. Une seule page pour toutes les largeurs : bureau, Electron,
 * tablette et téléphone (le miroir n'a pas d'écran de partage à lui).
 */
export function SharedListView() {
  const { token = "" } = useParams<{ token: string }>();
  const { t } = useTranslation("share");
  const { data, isLoading, isError, isFetching, refetch } = useSharedListView(token);
  const visitor = useShareVisitor(`/share/${token}`);
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);
  const items = useMemo(() => data?.items ?? [], [data]);
  const summary = useMemo(() => summarizeSharedList(items), [items]);

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

  const allSelected = summary.selectable.length > 0 && selected.size === summary.selectable.length;

  return (
    <ShareShell authed={visitor.authed}>
      {isLoading ? (
        <ShareListSkeleton />
      ) : isError || !data ? (
        <ShareError
          onRetry={() => void refetch()}
          retrying={isFetching}
          exitTo={visitor.authed ? "/" : visitor.loginPath}
          exitLabel={visitor.authed ? t("goHome") : t("joinSignIn")}
        />
      ) : (
        <main className="px-4 pb-32 sm:px-6 md:px-12">
          <div className="flex flex-col gap-8 pt-2 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
            <SharedListHeader ownerUsername={data.ownerUsername} kind={kind} summary={summary} />
            <div className="w-full shrink-0 animate-fade-slide-up lg:w-[22rem]">
              <ShareJoinCard
                ownerUsername={data.ownerUsername}
                kind={kind}
                authed={visitor.authed}
                loginPath={visitor.loginPath}
                registerPath={visitor.registerPath}
              />
            </div>
          </div>

          {items.length === 0 ? (
            <ShareListEmpty ownerUsername={data.ownerUsername} />
          ) : (
            <section aria-label={t(kind === "likes" ? "titleLikes" : "titleWatchlist", { name: data.ownerUsername })} className="mt-10">
              {visitor.authed && summary.selectable.length > 0 && (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAdded(false);
                      setSelected(allSelected ? new Set() : new Set(summary.selectable));
                    }}
                    className="h-10 cursor-pointer rounded-full border border-line-subtle bg-fill-subtle px-4 text-sm font-semibold text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  >
                    {allSelected ? t("deselectAll") : t("selectAll")}
                  </button>
                </div>
              )}
              <SharedListGrid items={items} authed={visitor.authed} selected={selected} onToggle={toggle} token={token} />
            </section>
          )}

          {visitor.authed && (
            <SharedListAddBar
              kind={kind}
              count={selected.size}
              isAdding={addMut.isPending}
              added={added}
              onAdd={() => addMut.mutate([...selected])}
            />
          )}
        </main>
      )}
    </ShareShell>
  );
}
