import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useUserId, forgetAutoRetired, type SharedListData } from "@tentacle-tv/api-client";
import { SharedListHeader } from "./SharedListHeader";
import { ShareJoinCard } from "./ShareJoinCard";
import { SharedListGrid } from "./SharedListGrid";
import { SharedListAddBar } from "./SharedListAddBar";
import { ShareListEmpty } from "./ShareStates";
import { summarizeSharedList } from "./shareSummary";
import type { ShareVisitor } from "./useShareVisitor";

interface Props {
  token: string;
  data: SharedListData;
  visitor: ShareVisitor;
}

/**
 * Une liste partagée (Ma liste ou titres likés), une fois chargée par la page
 * `/share/:token`. Le visiteur sans compte voit ce qu'on lui partage et
 * comment rejoindre le serveur ; connecté, il coche des titres et les ajoute
 * à sa propre liste. Une seule mise en page pour toutes les largeurs :
 * bureau, Electron, tablette et téléphone.
 */
export function SharedListBody({ token, data, visitor }: Props) {
  const { t } = useTranslation("share");
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);
  const items = useMemo(() => data.items ?? [], [data]);
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
  const kind = data.kind ?? "watchlist";
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
  );
}
