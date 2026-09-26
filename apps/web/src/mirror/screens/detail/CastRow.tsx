import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

type Person = NonNullable<MediaItem["People"]>[number];

const CREW_TYPES = ["Director", "Writer", "Producer", "Composer"] as const;
const MAX_ACTORS = 20;
const AVATAR = 60;

/**
 * `CastRow` de l'app : l'équipe (libellé 11 tertiaire, noms 13 secondaires,
 * 640 au plus), puis la distribution en rangée — avatars ronds de 60 dans des
 * colonnes de 76, écart 12, initiale violette sans photo. Toucher un acteur
 * ouvre sa filmographie (`/search?person=…`).
 */
export const CastRow = memo(function CastRow({ people }: { people: Person[] }) {
  const { t } = useTranslation("common");
  const { t: ts } = useTranslation("search");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const actors = people.filter((p) => p.Type === "Actor").slice(0, MAX_ACTORS);
  const crewGroups = CREW_TYPES.map((type) => ({ type, members: people.filter((p) => p.Type === type) }))
    .filter((g) => g.members.length > 0);

  if (!actors.length && !crewGroups.length) return null;

  const openPerson = (p: Person) => {
    const params = new URLSearchParams({ person: p.Id, name: p.Name, tag: p.PrimaryImageTag ?? "" });
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="mt-5">
      {crewGroups.length > 0 && (
        <div className="mb-4 max-w-[640px] px-4">
          {crewGroups.map((g) => (
            <div key={g.type} className="mb-2">
              <p className="text-[11px] font-semibold text-content-tertiary">{t(g.type.toLowerCase())}</p>
              <p className="mt-0.5 text-[13px] tracking-[-0.075px] text-content-secondary">
                {g.members.map((m) => m.Name).join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}

      {actors.length > 0 && (
        <div>
          <h3 className="mb-3 px-4 text-[18px] font-bold tracking-[-0.4px] text-content-primary">{t("cast")}</h3>
          <div className="mirror-no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4">
            {actors.map((person) => (
              <button
                key={person.Id}
                type="button"
                onClick={() => openPerson(person)}
                aria-label={`${person.Name}${person.Role ? `, ${person.Role}` : ""}`}
                title={ts("filmography")}
                className="mirror-detail-fade-press flex w-[76px] shrink-0 flex-col items-center"
              >
                {person.PrimaryImageTag ? (
                  <img
                    src={client.getImageUrl(person.Id, "Primary", { height: 120, quality: 80 })}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="rounded-full bg-surface-2 object-cover"
                    style={{ width: AVATAR, height: AVATAR }}
                  />
                ) : (
                  <span
                    className="flex items-center justify-center rounded-full bg-[var(--brand-soft)] text-[18px] font-bold text-brand"
                    style={{ width: AVATAR, height: AVATAR }}
                  >
                    {person.Name.charAt(0)}
                  </span>
                )}
                <span className="mt-1 w-full truncate text-center text-[11px] font-semibold text-content-primary">{person.Name}</span>
                {person.Role && (
                  <span className="mt-px w-full truncate text-center text-[10px] font-bold tracking-[0.3px] text-content-tertiary">
                    {person.Role}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
