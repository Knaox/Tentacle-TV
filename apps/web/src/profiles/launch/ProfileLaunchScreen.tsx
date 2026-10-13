import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { PickedProfileDto, PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { accountUserId } from "../../auth/profileSession";
import { loadPickerProfiles, pickerProfilesKey } from "../api/pickerGateway";
import { usePickFlow } from "../pick/usePickFlow";
import { WhoIsWatchingView } from "../picker/WhoIsWatchingView";
import { commitPick } from "../switch/commitPick";
import { ProfileCurtain, type CurtainProfile } from "../switch/ProfileCurtain";
import { pickerModelOf } from "./pickerModel";

/** « Ouverture de Léa… » ne paraît que si le serveur tarde au-delà (comme sur la TV). */
const OPENING_HINT_DELAY_MS = 500;

/** La page de la Famille, où « Gérer les profils » mène (session personnelle). */
const FAMILY_SETTINGS_PATH = "/settings/family";

interface ProfileLaunchScreenProps {
  /** La dernière liste connue (le miroir) : la rangée paraît avant toute attente. */
  initialListing: PickerProfilesDto | null;
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
export function ProfileLaunchScreen({ initialListing, onDone, onAccountLost }: ProfileLaunchScreenProps) {
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

  const onPicked = useCallback(async (picked: PickedProfileDto) => {
    const result = await commitPick(picked, { onCurtain: setCurtain, landing: landing.current });
    if (result === "stay") onDone(landing.current);
  }, [onDone]);

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
  const onManage = useCallback(() => {
    landing.current = FAMILY_SETTINGS_PATH;
    if (own) choose(own.userId);
  }, [own, choose]);
  const onPick = useCallback((profileId: string) => {
    landing.current = undefined;
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
      flow,
      openingLabel: slowOpening && flow.opening ? t("opening", { name: profiles.find((p) => p.userId === flow.opening)?.name ?? "" }) : null,
      language: i18n.language,
      t,
    }),
    [listing.data, listing.isError, flow, slowOpening, profiles, i18n.language, t],
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
