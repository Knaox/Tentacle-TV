import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  useLikedPeople,
  useLikePerson,
  usePersonSearch,
  useUnlikePerson,
} from "@tentacle-tv/api-client";
import { SettingsSection } from "@tentacle-tv/ui";
import { SETTING_FIELD } from "../SettingToggleRow";

/**
 * Section « Acteurs favoris » : les personnes aimées (chips avec retrait) et
 * une recherche TMDB débouncée pour en ajouter. L'autre point de saisie vit
 * sur le casting des fiches (ActorLikeButton) — même liste, mêmes rangées
 * « Avec {acteur} » derrière.
 */
export function LikedActors() {
  const { t } = useTranslation("preferences");
  const { data } = useLikedPeople();
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

  const people = data?.people ?? [];
  const likedIds = new Set(people.map((p) => p.personId));
  const results = (search?.results ?? []).filter((r) => !likedIds.has(r.personId)).slice(0, 6);

  return (
    <SettingsSection title={t("persoActorsTitle")} caption={t("persoActorsCaption")}>
      <div className="flex flex-col gap-4 p-5">
        {people.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <span
                key={p.personId}
                className="flex items-center gap-1.5 rounded-full border border-[rgba(var(--brand-rgb),0.4)] bg-[var(--brand-soft)] py-1 pl-3 pr-1.5 text-sm text-content-primary"
              >
                {p.name}
                <button
                  type="button"
                  onClick={() => unlike.mutate(p.personId)}
                  aria-label={t("persoActorsRemove", { name: p.name })}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-content-tertiary">{t("persoActorsEmpty")}</p>
        )}

        <div>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("persoActorsSearchPlaceholder")}
            aria-label={t("persoActorsSearchPlaceholder")}
            className={`${SETTING_FIELD} w-full`}
          />
          {query.trim().length >= 2 && (
            <div className="mt-2 flex flex-col gap-1">
              {results.map((r) => (
                <button
                  key={r.personId}
                  type="button"
                  onClick={() => {
                    like.mutate({ personId: r.personId, name: r.name, profilePath: r.profilePath });
                    setInput("");
                  }}
                  className="rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-fill-soft"
                >
                  <span className="font-medium text-content-primary">{r.name}</span>
                  {r.knownFor.length > 0 && (
                    <span className="ml-2 text-xs text-content-tertiary">{r.knownFor.join(" · ")}</span>
                  )}
                </button>
              ))}
              {!isFetching && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-content-tertiary">{t("persoActorsNoResult")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
