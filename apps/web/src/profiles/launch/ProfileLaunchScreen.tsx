import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { PickedProfileDto, PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { accountUserId } from "../../auth/profileSession";
import { loadPickerProfiles, pickerProfilesKey } from "../api/pickerGateway";
import { usePickFlow } from "../pick/usePickFlow";
import { WhoIsWatchingView } from "../picker/WhoIsWatchingView";
import { announceArrival } from "../switch/arrival";
import { commitPick, curtainOf } from "../switch/commitPick";
import { ProfileCurtain, type CurtainProfile } from "../switch/ProfileCurtain";
import { pickerModelOf } from "./pickerModel";

/** « Ouverture de Léa… » ne paraît que si le serveur tarde au-delà (comme sur la TV). */
const OPENING_HINT_DELAY_MS = 500;

/** La chute du rideau (`ProfileCurtain`, 200 ms) : le sélecteur s'efface dessous, pas avant. */
const CURTAIN_FALL_MS = 200;

/** La page de la Famille, où « Gérer les profils » mène (session personnelle). */
const FAMILY_SETTINGS_PATH = "/settings/family";

interface ProfileLaunchScreenProps {
  /** La dernière liste connue (le miroir) : la rangée paraît avant toute attente. */
  initialListing: PickerProfilesDto | null;
  /** On revient ici parce que la session d'un profil a pris fin : le dire. */
  ended?: boolean;
  /** Le profil choisi est le compte, en session personnelle : l'application, sans rechargement. */
  onDone: (landing?: string) => void;
  /** La session personnelle a été refusée : déconnexion. */
  onAccountLost: () => void;
}

/**
 * « Qui regarde ? » à l'ouverture du bureau — le CONTRÔLEUR : la liste
 * (relue au serveur, la dernière connue d'abord), le pavé du code PIN,
 * l'entrée dans un profil (la tuile glisse au centre, le rideau tombe, la page
 * se recharge au nom du profil) et « Gérer les profils » (son propre profil
 * d'abord, derrière son code, puis Réglages › Famille). La vue est
 * `WhoIsWatchingView`.
 */
export function ProfileLaunchScreen({ initialListing, ended = false, onDone, onAccountLost }: ProfileLaunchScreenProps) {
  const { t, i18n } = useTranslation("profilePicker");
  const client = useJellyfinClient();
  const accountId = accountUserId();
  const listing = useQuery({
    queryKey: pickerProfilesKey(accountId),
    queryFn: ({ signal }) => loadPickerProfiles(signal),
    initialData: initialListing ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    retry: false,
  });
  const profiles = useMemo<readonly PickerProfileDto[]>(() => listing.data?.profiles ?? [], [listing.data]);
  const [curtain, setCurtain] = useState<CurtainProfile | null>(null);
  const [slowOpening, setSlowOpening] = useState(false);
  const landing = useRef<string | undefined>(undefined);

  const liftCurtain = useCallback(() => setCurtain(null), []);
  const onPicked = useCallback(async (picked: PickedProfileDto) => {
    // Une bascule qui échoue après la chute du rideau le relève : le refus se
    // dit sur le sélecteur (`usePickFlow`), jamais sous un rideau resté.
    const result = await commitPick(picked, { onCurtain: setCurtain, onCurtainLifted: liftCurtain, landing: landing.current });
    if (result !== "stay") return;
    // SON profil, sans rechargement : le rideau tombe sur le sélecteur, puis
    // l'application paraît dessous quand il se lève (`ProfileArrival`).
    announceArrival(curtainOf(picked.profile));
    await new Promise((resolve) => setTimeout(resolve, CURTAIN_FALL_MS));
    onDone(landing.current);
  }, [onDone, liftCurtain]);

  const { refetch } = listing;
  const flow = usePickFlow({
    profiles,
    deviceName: client.getDeviceName(),
    onPicked,
    onStale: useCallback(() => void refetch(), [refetch]),
    onAccountLost,
  });

  // « Ouverture de Léa… » : seulement si le serveur tarde.
  useEffect(() => {
    setSlowOpening(false);
    if (!flow.opening) return;
    const timer = window.setTimeout(() => setSlowOpening(true), OPENING_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [flow.opening]);

  // « Gérer les profils » : SON profil d'abord (derrière son code), puis la page
  // de la Famille. Un autre choix, ou le retour du pavé, oublie la destination.
  const own = profiles.find((profile) => profile.personal) ?? null;
  const { choose, back } = flow;
  const [lastChosen, setLastChosen] = useState<string | null>(null);
  const onManage = useCallback(() => {
    landing.current = FAMILY_SETTINGS_PATH;
    if (own) {
      setLastChosen(own.userId);
      choose(own.userId);
    }
  }, [own, choose]);
  const onPick = useCallback((profileId: string) => {
    landing.current = undefined;
    setLastChosen(profileId);
    choose(profileId);
  }, [choose]);
  const onBack = useCallback(() => {
    landing.current = undefined;
    back();
  }, [back]);

  const model = useMemo(
    () => pickerModelOf({
      listing: listing.data ?? null,
      error: listing.isError && !listing.data ? t("loadFailed") : null,
      flow: { ...flow, notice: flow.notice ?? (ended ? t("session.ended") : null) },
      lastChosen,
      openingLabel: slowOpening && flow.opening ? t("opening", { name: profiles.find((p) => p.userId === flow.opening)?.name ?? "" }) : null,
      language: i18n.language,
      t,
    }),
    [listing.data, listing.isError, flow, ended, lastChosen, slowOpening, profiles, i18n.language, t],
  );

  return (
    <>
      <WhoIsWatchingView
        model={model}
        onPick={onPick}
        onManage={onManage}
        onRetry={() => void refetch()}
        onDigit={flow.digit}
        onErase={flow.erase}
        onBack={onBack}
      />
      {curtain && <ProfileCurtain profile={curtain} phase="entering" />}
    </>
  );
}
