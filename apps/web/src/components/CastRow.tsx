import { useJellyfinClient } from "@tentacle/api-client";

interface Person {
  Name: string;
  Id: string;
  Role?: string;
  Type: string;
  PrimaryImageTag?: string;
}

interface Studio {
  Name: string;
  Id: string;
}

interface CastRowProps {
  people: Person[];
  studios?: Studio[];
}

const CREW_TYPES: { type: string; label: string }[] = [
  { type: "Director", label: "Réalisation" },
  { type: "Writer", label: "Scénario" },
  { type: "Producer", label: "Production" },
  { type: "Composer", label: "Musique" },
];

export function CastRow({ people, studios }: CastRowProps) {
  const client = useJellyfinClient();
  const actors = people.filter((p) => p.Type === "Actor").slice(0, 20);

  const crewGroups = CREW_TYPES.map(({ type, label }) => ({
    label,
    members: people.filter((p) => p.Type === type),
  })).filter((g) => g.members.length > 0);

  const hasCrew = crewGroups.length > 0 || (studios && studios.length > 0);
  if (!actors.length && !hasCrew) return null;

  return (
    <section className="space-y-6 px-4 py-4 md:px-12">
      {/* Crew & Studios */}
      {hasCrew && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-white/90">Équipe</h3>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {crewGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-medium text-white/40">{group.label}</p>
                <p className="mt-0.5 text-sm text-white/80">
                  {group.members.map((m) => m.Name).join(", ")}
                </p>
              </div>
            ))}
            {studios && studios.length > 0 && (
              <div>
                <p className="text-xs font-medium text-white/40">Studio</p>
                <p className="mt-0.5 text-sm text-white/80">
                  {studios.map((s) => s.Name).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actors */}
      {actors.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-white/90">Casting</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {actors.map((person) => (
              <div key={person.Id} className="w-20 flex-shrink-0 text-center sm:w-24">
                <div className="mx-auto h-20 w-20 overflow-hidden rounded-full bg-tentacle-surface sm:h-24 sm:w-24">
                  {person.PrimaryImageTag ? (
                    <img
                      src={client.getImageUrl(person.Id, "Primary", { width: 200, quality: 85 })}
                      alt={person.Name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-white/20">
                      {person.Name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium text-white line-clamp-1">{person.Name}</p>
                {person.Role && <p className="text-xs text-white/40 line-clamp-1">{person.Role}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
