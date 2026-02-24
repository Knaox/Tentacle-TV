import { useJellyfinClient } from "@tentacle/api-client";

interface Person {
  Name: string;
  Id: string;
  Role?: string;
  Type: string;
  PrimaryImageTag?: string;
}

export function CastRow({ people }: { people: Person[] }) {
  const client = useJellyfinClient();
  const actors = people.filter((p) => p.Type === "Actor").slice(0, 20);

  if (!actors.length) return null;

  return (
    <section className="px-12 py-4">
      <h3 className="mb-3 text-lg font-semibold text-white/90">Casting</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {actors.map((person) => (
          <div key={person.Id} className="w-24 flex-shrink-0 text-center">
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-tentacle-surface">
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
    </section>
  );
}
