const TECH_STACK = [
  { name: "React", url: "https://react.dev", desc: "Interface utilisateur" },
  { name: "TypeScript", url: "https://typescriptlang.org", desc: "Typage statique" },
  { name: "Vite", url: "https://vitejs.dev", desc: "Bundler & dev server" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", desc: "Framework CSS utilitaire" },
  { name: "Framer Motion", url: "https://motion.dev", desc: "Animations" },
  { name: "TanStack Query", url: "https://tanstack.com/query", desc: "Gestion de cache & requêtes" },
  { name: "React Router", url: "https://reactrouter.com", desc: "Navigation SPA" },
  { name: "Fastify", url: "https://fastify.dev", desc: "Serveur backend" },
  { name: "Tauri", url: "https://tauri.app", desc: "Application desktop native" },
  { name: "Expo", url: "https://expo.dev", desc: "Application mobile" },
  { name: "React Native", url: "https://reactnative.dev", desc: "Framework mobile" },
];

const SERVICES = [
  { name: "Jellyfin", url: "https://jellyfin.org", desc: "Serveur multimédia open-source" },
  { name: "Overseerr / Jellyseerr", url: "https://overseerr.dev", desc: "Gestion de demandes de contenus" },
];

export function Credits() {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-12">
      <h1 className="text-2xl font-bold text-white">Crédits & Licences</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        Tentacle est construit grâce à de nombreux projets open-source. Merci à
        toutes les communautés qui rendent ce projet possible.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-white">Technologies</h2>
      <ul className="mt-3 divide-y divide-white/5">
        {TECH_STACK.map((t) => (
          <li key={t.name} className="flex items-center justify-between py-2.5">
            <div>
              <a href={t.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-purple-400 hover:underline">
                {t.name}
              </a>
              <p className="text-xs text-white/40">{t.desc}</p>
            </div>
            <ExternalIcon />
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">Services compatibles</h2>
      <ul className="mt-3 divide-y divide-white/5">
        {SERVICES.map((s) => (
          <li key={s.name} className="flex items-center justify-between py-2.5">
            <div>
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-purple-400 hover:underline">
                {s.name}
              </a>
              <p className="text-xs text-white/40">{s.desc}</p>
            </div>
            <ExternalIcon />
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">Licence</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        Tentacle est distribué sous licence MIT. Les bibliothèques tierces
        utilisées sont soumises à leurs licences respectives (MIT, Apache 2.0, BSD, etc.).
      </p>

      <p className="mt-12 text-xs text-white/30">
        Cette page est fournie à titre informatif. Les noms et marques
        appartiennent à leurs propriétaires respectifs.
      </p>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}
