import { Link } from "react-router-dom";
import { useAppConfig } from "@tentacle/api-client";

export function About() {
  const { data: config } = useAppConfig();

  return (
    <div className="mx-auto max-w-2xl px-6 pt-12">
      <div className="flex items-center gap-4">
        <img src="/tentacle-logo-pirate.svg" alt="" className="h-14 w-14" />
        <div>
          <h1 className="text-3xl font-bold text-white">Tentacle</h1>
          <p className="text-sm text-white/50">Version {config?.version ?? "..."}</p>
        </div>
      </div>

      <p className="mt-8 leading-relaxed text-white/70">
        Tentacle est un client multimédia premium conçu pour offrir une expérience
        de streaming fluide et élégante. Disponible sur Web, Desktop, Mobile et TV,
        il permet de parcourir, rechercher et regarder votre bibliothèque de médias
        depuis n'importe quel appareil.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-white">Fonctionnalités</h2>
      <ul className="mt-3 space-y-2 text-sm text-white/60">
        <li className="flex items-center gap-2"><Dot /> Lecteur vidéo intégré avec sélection pistes audio/sous-titres</li>
        <li className="flex items-center gap-2"><Dot /> Reprise automatique de la lecture</li>
        <li className="flex items-center gap-2"><Dot /> Système de demandes de contenus</li>
        <li className="flex items-center gap-2"><Dot /> Mode bureau natif avec lecteur hautes performances</li>
        <li className="flex items-center gap-2"><Dot /> Interface adaptative (mobile, tablette, desktop, TV)</li>
        <li className="flex items-center gap-2"><Dot /> Notifications et système de support intégrés</li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">Contact</h2>
      <p className="mt-3 text-sm text-white/60">
        Pour toute question ou signalement de bug, utilisez le système de support
        intégré depuis le menu Aide ou contactez l'administrateur de votre serveur.
      </p>

      <Link to="/credits" className="mt-10 inline-flex items-center gap-2 text-sm text-purple-400 hover:underline">
        Crédits & Licences open-source
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </Link>

      <p className="mt-8 text-xs text-white/30">
        Tentacle {config?.version ?? ""} — {new Date().getFullYear()}
      </p>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />;
}
