import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import {
  useLikedPeople,
  useLikePerson,
  usePersonSearch,
  usePersonSuggestions,
  useUnlikePerson,
} from "@tentacle-tv/api-client";
import type { PersonSearchResult } from "@tentacle-tv/api-client";
import { RowHeader } from "../rows/RowHeader";

const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";

interface BubblePerson {
  personId: number;
  name: string;
  profilePath: string | null;
  knownFor?: string[];
}

/** Portrait rond + nom, avec l'action en pastille (aimer ou retirer). */
function PersonBubble({
  person,
  mode,
  pending,
  onAction,
}: {
  person: BubblePerson;
  mode: "liked" | "suggestion";
  pending?: boolean;
  onAction: () => void;
}) {
  const { t } = useTranslation("reco");
  const label =
    mode === "liked"
      ? t("actorsRemove", { name: person.name })
      : t("actorsLike", { name: person.name });

  return (
    <div className="relative w-20 shrink-0 text-center sm:w-24">
      <div
        className={`mx-auto h-20 w-20 overflow-hidden rounded-full bg-fill-soft sm:h-24 sm:w-24 ${
          mode === "liked" ? "ring-2 ring-[var(--brand)]" : "ring-1 ring-line-subtle"
        }`}
      >
        {person.profilePath ? (
          <img
            src={`${TMDB_PROFILE}${person.profilePath}`}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-content-disabled">
            {person.name.charAt(0)}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={onAction}
        className={`absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-md transition-colors ${
          mode === "liked"
            ? "border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg"
            : "border-line-strong bg-surface-modal text-content-secondary hover:text-content-primary"
        }`}
      >
        {mode === "liked" ? <X size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
      </button>
      <p className="mt-2 line-clamp-1 text-xs font-medium text-content-primary">{person.name}</p>
      {mode === "suggestion" && person.knownFor?.[0] && (
        <p className="line-clamp-1 text-[11px] text-content-quaternary">{person.knownFor[0]}</p>
      )}
    </div>
  );
}

/**
 * « Vos acteurs », SUR la page Recommandations : les personnes aimées
 * (portraits cerclés de marque, retrait à la croix), des acteurs CONNUS en
 * suggestion pour amorcer, et une recherche débouncée. Chaque like/retrait
 * régénère le pool côté serveur — les rangées « Avec {acteur} » suivent.
 * L'autre point de saisie reste le cœur sur le casting des fiches.
 */
export function LikedActorsPanel() {
  const { t } = useTranslation("reco");
  const { data: likedData } = useLikedPeople();
  const { data: suggestions } = usePersonSuggestions();
  const like = useLikePerson();
  const unlike = useUnlikePerson();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Débounce de saisie : la recherche ne part pas à chaque frappe.
  useEffect(() => {
    const id = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(id);
  }, [input]);
  const { data: search, isFetching } = usePersonSearch(query);

  const liked = likedData?.people ?? [];
  const likedIds = new Set(liked.map((p) => p.personId));
  const searching = query.trim().length >= 2;
  const shown: PersonSearchResult[] = (
    searching ? (search?.results ?? []) : (suggestions?.results ?? [])
  ).filter((r) => !likedIds.has(r.personId));

  const addPerson = (r: PersonSearchResult) => {
    like.mutate({ personId: r.personId, name: r.name, profilePath: r.profilePath });
    setInput("");
  };

  return (
    <section className="mb-10" aria-label={t("actorsTitle")}>
      <RowHeader title={t("actorsTitle")} />
      <div className="row-gutter">
        <p className="mb-4 max-w-2xl text-sm text-content-tertiary">{t("actorsHint")}</p>
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("actorsSearchPlaceholder")}
          aria-label={t("actorsSearchPlaceholder")}
          className="h-10 w-full max-w-sm rounded-full border border-line-subtle bg-fill-subtle px-4 text-sm text-content-primary outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.3)] placeholder:text-content-quaternary"
        />

        {liked.length > 0 && (
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {liked.map((p) => (
              <PersonBubble
                key={p.personId}
                person={p}
                mode="liked"
                pending={unlike.isPending}
                onAction={() => unlike.mutate(p.personId)}
              />
            ))}
          </div>
        )}

        <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-content-quaternary">
          {searching ? t("actorsResults") : t("actorsSuggested")}
        </p>
        {shown.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {shown.map((r) => (
              <PersonBubble
                key={r.personId}
                person={r}
                mode="suggestion"
                pending={like.isPending}
                onAction={() => addPerson(r)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-content-tertiary">
            {searching && !isFetching ? t("actorsNoResult") : "…"}
          </p>
        )}
      </div>
    </section>
  );
}
