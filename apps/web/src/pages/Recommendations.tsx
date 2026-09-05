import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useJellyfinClient, useRecoPage } from "@tentacle-tv/api-client";
import { ContentErrorState } from "../components/ContentErrorState";
import { PageTransition } from "../components/PageTransition";
import { ColdStart } from "../components/reco/ColdStart";
import { heroSelectionFromRows } from "../components/reco/hero/recoHeroSlides";
import { RecoPageBody } from "../components/reco/RecoPageBody";
import { RecoPageSkeleton } from "../components/reco/RecoPageSkeleton";
import { useSettledRecoPage } from "../components/reco/useSettledRecoPage";
import { useRecoFilter } from "../hooks/useRecoFilter";
import { hasColdStartAck, markColdStartAck } from "../lib/coldStartAck";

/**
 * Page Recommandations — UNE requête (`GET /api/reco/page`), rendue d'un coup
 * depuis le cache (persisté sur disque, hydraté au démarrage) et revalidée en
 * silence : le squelette n'existe que pour la toute première visite d'un
 * appareil. Toute la matière vient du backend (snapshot précalculé, filtré
 * strictement par plateformes) ; la page choisit seulement quoi montrer
 * selon l'état du moteur. Elle n'est jamais vide : les rangées globales
 * tiennent la scène dans tous les états, et un bandeau dit ce qui se passe.
 */
export function Recommendations() {
  const { t } = useTranslation("reco");
  // Le filtre de plateformes : store (miroir local) — la synchro serveur vit
  // au niveau de la session (RecoFilterBinding), l'accueil en dépend aussi.
  const { selected, filterKey } = useRecoFilter();
  const client = useJellyfinClient();
  const { data: served, isPlaceholderData, isError, refetch } = useRecoPage(selected);
  // La page AFFICHÉE suit la page servie une fois ses premières affiches
  // décodées (budget borné) : un changement de filtre arrive habillé.
  const { page, settling } = useSettledRecoPage(served, client);
  // Le héros SUIT le filtre — et la page affichée, jamais en avance sur elle.
  // Tirage au hasard, une graine par visite : la bannière change à chaque
  // passage, et tient le temps de la visite.
  const heroSeed = useRef(Math.random());
  const hero = useMemo(() => heroSelectionFromRows(page?.rows, heroSeed.current), [page?.rows]);

  // Le démarrage à froid est COLLANT : une fois affiché (« hold »), il ne cède
  // l'écran qu'au bouton « Voir mes recommandations » — jamais à un refetch
  // d'arrière-plan en pleine sélection. « dismissed » survit tant que le
  // serveur dit encore « cold » (la bascule est instantanée, le profil se
  // reconstruit derrière) : sans lui, la grille se ré-afficherait une seconde
  // après le clic. L'état se réarme dès que le serveur a vraiment tourné.
  // Et il ne s'IMPOSE qu'une fois (accusé par compte et par appareil) : les
  // visites suivantes passent par le bandeau CTA, jamais par le plein écran.
  const [phase, setPhase] = useState<"auto" | "hold" | "dismissed">("auto");
  useEffect(() => {
    if (page?.state === "cold") {
      setPhase((p) => (p === "auto" && page.tmdbConfigured !== false && !hasColdStartAck() ? "hold" : p));
    } else {
      setPhase("auto");
    }
  }, [page?.state, page?.tmdbConfigured]);
  // L'accusé se pose dès que la grille a été VUE — « Plus tard » compte aussi.
  useEffect(() => {
    if (phase === "hold") markColdStartAck();
  }, [phase]);

  // UNE seule PageTransition : squelette → page sans rejouer le fondu.
  return (
    <PageTransition>
      {!page ? (
        isError ? (
          <div className="min-h-[60vh]">
            <ContentErrorState onRetry={() => void refetch()} />
          </div>
        ) : (
          <RecoPageSkeleton />
        )
      ) : page.state === "disabled" && page.rows.length === 0 ? (
        // Vieux serveur qui ne sert AUCUNE rangée en mode désactivé : l'écran
        // historique demeure. Un serveur à jour sert les rangées globales.
        <div className="row-gutter flex min-h-[60vh] flex-col items-start justify-center">
          <h1 className="text-2xl font-bold text-content-primary">{t("pageTitle")}</h1>
          <p className="mt-3 max-w-xl text-content-secondary">{t("disabledBody")}</p>
          <Link
            to="/settings/personalization"
            className="mt-5 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 py-2.5 font-semibold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
          >
            {t("disabledCta")}
          </Link>
        </div>
      ) : phase === "hold" ? (
        <div className="min-h-screen pb-20">
          <ColdStart signalCount={page.signalCount} onDone={() => setPhase("dismissed")} />
        </div>
      ) : (
        <RecoPageBody
          page={page}
          filterKey={filterKey}
          stale={isPlaceholderData || settling}
          hero={hero}
          onOpenColdStart={() => setPhase("hold")}
        />
      )}
    </PageTransition>
  );
}
