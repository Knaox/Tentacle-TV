import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SharedStatsView as SharedStatsData } from "@tentacle-tv/shared";
import { StatsVoiceProvider, type StatsVoice } from "../../stats/statsVoice";
import { ShareJoinCard } from "../ShareJoinCard";
import type { ShareVisitor } from "../useShareVisitor";
import { PublicStatsBody } from "./PublicStatsBody";
import { SharedStatsHeader } from "./SharedStatsHeader";

interface Props {
  token: string;
  view: SharedStatsData;
  visitor: ShareVisitor;
}

/**
 * La page PUBLIQUE des statistiques partagées (/share/:token d'un lien de
 * statistiques), dans la coquille des partages : l'en-tête qui dit qui
 * partage et sur quelle période, puis les cartes de « Vos statistiques »
 * dans la voix publique — « Ses genres », des titres qui ouvrent leur fiche
 * publique, des visages sans lien. Rien ne s'y lit.
 *
 * La carte « comment regarder » garde sa place de la liste partagée au
 * bureau (en haut à droite) ; au téléphone, elle passe après les chiffres —
 * on vient voir des statistiques, pas s'inscrire.
 */
export function SharedStatsView({ token, view, visitor }: Props) {
  const { t } = useTranslation("statsPublic");
  const name = view.ownerUsername;
  const voice = useMemo<StatsVoice>(
    () => ({
      audience: "public",
      namespaces: ["statsPublic", "stats"],
      vars: { name },
      titleHref: (id) => `/share/${token}/${id}`,
      personHref: () => null,
    }),
    [name, token]
  );

  // L'onglet du visiteur dit ce qu'il regarde ; rendu à la sortie.
  useEffect(() => {
    const previous = document.title;
    document.title = `${t("title", { name })} · Tentacle TV`;
    return () => {
      document.title = previous;
    };
  }, [t, name]);

  const join = (
    <ShareJoinCard
      ownerUsername={name}
      kind="stats"
      authed={visitor.authed}
      loginPath={visitor.loginPath}
      registerPath={visitor.registerPath}
    />
  );

  return (
    <StatsVoiceProvider value={voice}>
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-20 sm:px-6 md:px-12">
        <div className="flex flex-col gap-8 pb-8 pt-2 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <SharedStatsHeader period={view.stats.period} generatedAt={view.stats.generatedAt} />
          <div className="hidden w-[22rem] shrink-0 animate-fade-slide-up lg:block">{join}</div>
        </div>
        <PublicStatsBody stats={view.stats} />
        <div className="mx-auto mt-10 max-w-md lg:hidden">{join}</div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-content-tertiary">{t("footer")}</p>
      </main>
    </StatsVoiceProvider>
  );
}
