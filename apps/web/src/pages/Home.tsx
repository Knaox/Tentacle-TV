import { useLibraries } from "@tentacle/api-client";
import { GlassCard, Shimmer } from "@tentacle/ui";

export function Home() {
  const { data: libraries, isLoading } = useLibraries();

  return (
    <div className="min-h-screen p-8">
      <header className="mb-12 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Tentacle
          </span>
        </h1>
      </header>

      <main>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Shimmer key={i} height="280px" />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {libraries?.map((lib) => (
              <section key={lib.Id}>
                <h2 className="mb-4 text-xl font-semibold text-white/90">
                  {lib.Name}
                </h2>
                <GlassCard className="p-6">
                  <p className="text-white/50">
                    Library content will be rendered here
                  </p>
                </GlassCard>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
