import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import {
  useLikedPeople,
  useLikePerson,
  usePersonSearch,
  usePersonSuggestions,
  useUnlikePerson,
  type PersonSearchResult,
} from "@tentacle-tv/api-client";
import { RowHeader } from "../../rows/RowHeader";

const SEARCH_DEBOUNCE_MS = 300;
const TMDB_PROFILE = "https://image.tmdb.org/t/p/w185";

/**
 * `LikedActorsPanel` de l'app : « Vos acteurs » au pied de Pour vous — les
 * personnes aimées (portraits de 80 cerclés de marque, retrait à la croix),
 * des suggestions pour amorcer, et une recherche débouncée (champ pilule de
 * 44, 420 au plus). Chaque like/retrait régénère le pool côté serveur.
 */
export function LikedActorsPanel() {
  const { t } = useTranslation("reco");
  const { data: likedData } = useLikedPeople();
  const { data: suggestions } = usePersonSuggestions();
  const like = useLikePerson();
  const unlike = useUnlikePerson();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);
  const { data: search, isFetching } = usePersonSearch(query);

  const liked = useMemo(() => likedData?.people ?? [], [likedData]);
  const searching = query.trim().length >= 2;
  const shown = useMemo(() => {
    const likedIds = new Set(liked.map((p) => p.personId));
    const source = searching ? (search?.results ?? []) : (suggestions?.results ?? []);
    return source.filter((r) => !likedIds.has(r.personId));
  }, [liked, searching, search, suggestions]);

  const addPerson = (r: PersonSearchResult) => {
    like.mutate({ personId: r.personId, name: r.name, profilePath: r.profilePath });
    setInput("");
    setQuery("");
  };

  return (
    <section className="mb-4 mt-6" aria-label={t("actorsTitle")}>
      <RowHeader title={t("actorsTitle")} />
      <p className="mb-3 max-w-[560px] px-4 text-[13px] text-content-tertiary">{t("actorsHint")}</p>
      <div className="px-4">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("actorsSearchPlaceholder")}
          aria-label={t("actorsSearchPlaceholder")}
          autoCorrect="off"
          autoCapitalize="words"
          enterKeyHint="search"
          className="h-11 w-full max-w-[420px] rounded-full border border-line-subtle bg-fill-subtle px-4 text-[15px] text-content-primary outline-none placeholder:text-content-quaternary focus:border-line-strong"
        />
      </div>

      {liked.length > 0 && (
        <BubbleTrack>
          {liked.map((p) => (
            <PersonBubble key={p.personId} person={p} liked pending={unlike.isPending} onAction={() => unlike.mutate(p.personId)} />
          ))}
        </BubbleTrack>
      )}

      <p className="mt-4 px-4 text-[10px] font-bold uppercase tracking-[0.8px] text-content-quaternary">
        {searching ? t("actorsResults") : t("actorsSuggested")}
      </p>
      {shown.length > 0 ? (
        <BubbleTrack>
          {shown.map((p) => (
            <PersonBubble key={p.personId} person={p} liked={false} pending={like.isPending} onAction={() => addPerson(p)} />
          ))}
        </BubbleTrack>
      ) : (
        <p className="mt-3 px-4 text-[13px] text-content-tertiary">{searching && !isFetching ? t("actorsNoResult") : "…"}</p>
      )}
    </section>
  );
}

function BubbleTrack({ children }: { children: ReactNode }) {
  return <div className="mirror-no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4 pt-4">{children}</div>;
}

/** `PersonBubble` de l'app : portrait rond de 80 + nom, action en pastille de 28. */
const PersonBubble = memo(function PersonBubble({ person, liked, pending, onAction }: {
  person: { personId: number; name: string; profilePath: string | null; knownFor?: string[] };
  liked: boolean;
  pending: boolean;
  onAction: () => void;
}) {
  const { t } = useTranslation("reco");
  const label = liked ? t("actorsRemove", { name: person.name }) : t("actorsLike", { name: person.name });
  return (
    <div className="relative flex w-[88px] shrink-0 flex-col items-center">
      <div
        className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-fill-soft ${liked ? "border-2 border-[var(--brand)]" : "border border-line-subtle"}`}
      >
        {person.profilePath ? (
          <img src={`${TMDB_PROFILE}${person.profilePath}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[26px] font-bold text-content-disabled">{person.name.charAt(0)}</span>
        )}
      </div>
      <button
        type="button"
        onClick={pending ? undefined : onAction}
        aria-label={label}
        className={`mirror-press absolute -right-0.5 -top-0.5 flex h-7 w-7 items-center justify-center rounded-full ${liked ? "bg-[var(--brand)] text-cta-brand-fg" : "bg-surface-2 text-content-primary"}`}
      >
        {liked ? <X size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
      </button>
      <p className="mt-2 w-full truncate text-center text-[13px] font-medium text-content-primary">{person.name}</p>
      {!liked && person.knownFor?.[0] ? (
        <p className="mt-0.5 w-full truncate text-center text-[11px] text-content-quaternary">{person.knownFor[0]}</p>
      ) : null}
    </div>
  );
});
