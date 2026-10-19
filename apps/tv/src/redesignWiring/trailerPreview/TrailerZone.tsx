import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { trailerPreviewSubjectKey } from "@tentacle-tv/shared";
import { previewSessionDwellLeft, previewZoneDetailsLeft, previewZoneShown } from "@tentacle-tv/tv-core";
import type { CardModel } from "../../redesign/cards/cardTypes";
import {
  HERO_STAGE_KEY,
  usePreviewZoneCard, usePreviewZoneState, usePreviewZoneStore, type PreviewZoneSlotProps, type PreviewZoneStore,
} from "../../redesign/cards/trailerPreviewPort";
import { PreviewStage } from "../../redesign/previewZone/PreviewStage";
import { PreviewZoneView } from "../../redesign/previewZone/PreviewZoneView";
import { zoneModelOfCard, zoneModelOfHero } from "../../redesign/previewZone/zoneModel";
import { useTrailerPreviewsEnabled } from "../../lib/trailerPreviewSettings";
import { useFocusHeld } from "./useFocusDwell";
import { usePreviewRemoteHint } from "./usePreviewRemote";
import { useZoneDetails } from "./useZoneDetails";
import { ZoneSession, type ZoneVideoWant } from "./ZoneSession";
import { ZoneVideo } from "./ZoneVideo";
import { useBootIntroPlaying } from "../boot/bootIntroGate";

/**
 * La ZONE D'APERÇU fournie au port (`PreviewZoneSlot`) — une par page, qui lit
 * le magasin de focus de sa page (`PreviewZoneScope`) :
 *
 * - le sujet (tv-core `previewZoneShown`) : la carte focalisée, aussitôt —
 *   son fond, son logo, son titre ; le héros de l'Accueil ; le repli ;
 * - les détails quand le focus a tenu (`useZoneDetails`) ;
 * - la bande-annonce : une SESSION par titre, montée quand le focus a tenu
 *   (`ZoneSession`, la machine du bureau au délai de l'utilisateur), qui pilote
 *   le LECTEUR UNIQUE de la zone (`ZoneVideo`) ; aperçus coupés : le fond seul.
 *
 * Une zone par page, donc un lecteur par page — mais seulement pour la page À
 * L'ÉCRAN : une page couverte (une fiche, une grille par-dessus l'Accueil)
 * coupe aussitôt son aperçu et démonte son lecteur (`useIsFocused`), sans
 * attendre ni le flou de la carte ni le délai d'inactivité. Il n'y a jamais
 * qu'un lecteur vivant.
 */
export const TrailerZone = memo(function TrailerZone(props: PreviewZoneSlotProps) {
  const store = usePreviewZoneStore();
  // Hors d'une portée (une page qui n'en pose pas) : la zone de repli, sans focus.
  return <Zone {...props} store={store ?? FALLBACK_STORE} />;
});

function Zone({ hero = null, fallback = null, stage, store }: PreviewZoneSlotProps & { store: PreviewZoneStore }) {
  const state = usePreviewZoneState(store);
  const lastCard = usePreviewZoneCard(store);
  const shown = previewZoneShown(state, { hasHero: hero !== null, fallbackId: fallback?.id ?? null });
  const card: CardModel | null =
    shown?.kind === "card" ? (lastCard?.id === shown.id ? lastCard : fallback?.id === shown.id ? fallback : null) : null;
  const heroShown = shown?.kind === "hero" && hero !== null;
  // Le sujet a le focus EN CE MOMENT (le repli n'en a jamais), sur la page à l'écran.
  const pageFocused = useIsFocused();
  const focused = pageFocused && state.focused && state.subject !== null && shown !== null && state.subject.kind === shown.kind;
  const since = focused ? state.since : null;

  const detailsWanted = useFocusHeld(card && !card.absent ? since : null, previewZoneDetailsLeft);
  const details = useZoneDetails(card && !card.absent ? card.id : null, detailsWanted);
  const model = useMemo(
    () => (heroShown && hero ? zoneModelOfHero(hero) : card ? zoneModelOfCard(card, details) : null),
    [heroShown, hero, card, details],
  );

  const previewsOn = useTrailerPreviewsEnabled();
  // Pendant l'ouverture du démarrage, aucun aperçu : le ta-dum d'abord.
  const introPlaying = useBootIntroPlaying();
  const enabled = previewsOn && !introPlaying;
  const subject = enabled ? (heroShown ? hero?.trailer ?? null : card?.trailer ?? null) : null;
  const subjectKey = subject ? trailerPreviewSubjectKey(subject) : null;
  const held = useFocusHeld(subject ? since : null, previewSessionDwellLeft);
  // Ce que veut la session, et si sa vidéo se montre — chacun marqué de la session qui le dit.
  const [want, setWant] = useState<Owned<ZoneVideoWant> | null>(null);
  const [shownBy, setShownBy] = useState<string | null>(null);
  const onVideo = useCallback((key: string, next: ZoneVideoWant | null) => {
    setWant((previous) => (next ? { key, value: next } : previous?.key === key ? null : previous));
  }, []);
  const onShown = useCallback((key: string, next: boolean) => {
    setShownBy((previous) => (next ? key : previous === key ? null : previous));
  }, []);
  const mine = want !== null && want.key === subjectKey ? want.value : null;
  // Montée quand le focus a tenu, gardée tant que sa vidéo existe (sa sortie).
  const sessionOn = pageFocused && subjectKey !== null && (held || mine !== null);
  const videoShown = sessionOn && shownBy === subjectKey;
  const remote = usePreviewRemoteHint(videoShown);
  // La scène dit à sa page les détails du titre (sous sa carte ouverte) et ce qui joue sa vidéo —
  // ce qu'elle montre VRAIMENT : coupée au changement de surface, la vidéo n'y est pas encore.
  const stageKey = heroShown ? HERO_STAGE_KEY : card?.id ?? null;
  const [stageLive, setStageLive] = useState<string | null>(null);
  const watching = videoShown && stageLive === stageKey ? stageKey : null;
  useEffect(() => {
    if (stage) store.setInfo({ model, watching });
  }, [stage, store, model, watching]);
  const video = pageFocused ? <ZoneVideo want={mine} /> : null;
  return (
    <>
      {sessionOn && subject ? (
        <ZoneSession key={subjectKey} sessionKey={subjectKey ?? ""} subject={subject} focused={focused} since={since} onShown={onShown} onVideo={onVideo} />
      ) : null}
      {stage ? (
        <PreviewStage
          rect={heroShown ? stage.hero ?? null : card ? stage.card : null}
          subjectKey={stageKey}
          video={video}
          videoShown={videoShown}
          remote={remote}
          onLiveChange={setStageLive}
        />
      ) : (
        <PreviewZoneView model={model} heroRoom={heroShown} video={video} videoShown={videoShown} remote={remote} />
      )}
    </>
  );
}

interface Owned<T> {
  key: string;
  value: T;
}

const FALLBACK_STATE = { subject: null, focused: false, since: null };
const FALLBACK_INFO = { model: null, watching: null };
const FALLBACK_STORE: PreviewZoneStore = {
  getState: () => FALLBACK_STATE,
  getCard: () => null,
  getInfo: () => FALLBACK_INFO,
  setInfo: () => undefined,
  subscribe: () => () => undefined,
  dispatch: () => undefined,
  refresh: () => undefined,
};
