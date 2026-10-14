import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { pickerStayChecked, pickerStayOf, type PickedProfileDto, type PickerProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { accountUserId } from "../../auth/profileSession";
import { loadPickerProfiles, pickerProfilesKey } from "../api/pickerGateway";
import { usePickFlow } from "../pick/usePickFlow";
import { WhoIsWatchingView } from "../picker/WhoIsWatchingView";
import { announceArrival } from "../switch/arrival";
import { commitPick, curtainOf } from "../switch/commitPick";
import { ProfileCurtain, type CurtainProfile } from "../switch/ProfileCurtain";
import { commitStay, switchActiveId, switchPick } from "../switcher/switchPlan";
import { pickerModelOf } from "./pickerModel";
import { readStayOnThisServer, writeStayOnThisServer } from "./stayOnDevice";

/** « Ouverture de Léa… » ne paraît que si le serveur tarde au-delà (comme sur la TV). */
const OPENING_HINT_DELAY_MS = 500;

/** La chute du rideau (`ProfileCurtain`, 200 ms) : le sélecteur s'efface dessous, pas avant. */
const CURTAIN_FALL_MS = 200;

/** La page de la Famille, où « Gérer les profils » mène (session personnelle). */
export const FAMILY_SETTINGS_PATH = "/settings/family";

/**
 * « Changer de profil » (menu de l'avatar) : l'écran s'ouvre sur l'application
 * déjà lancée, qui reste dessous (`switcher/WhoIsWatchingHost.tsx`).
 */
export interface SwitchContext {
  /** Le profil de la session de profil en cours ; null : la session personnelle. */
  activeProfileId: string | null;
  /** Refermer l'écran sans rien changer (Annuler, Échap, le profil en cours choisi). */
  onCancel: () => void;
  /** Watch Together, s'il y a un groupe à quitter avant une bascule. */
  leaveGroup?: () => Promise<void>;
}

interface ProfileLaunchScreenProps {
  /** La dernière liste connue (le miroir) : la rangée paraît avant toute attente. */
  initialListing: PickerProfilesDto | null;
  /** On revient ici parce que la session d'un profil a pris fin : le dire. */
  ended?: boolean;
  /** Le profil choisi est le compte, en session personnelle : l'application, sans rechargement. */
  onDone: (landing?: string) => void;
  /** La session personnelle a été refusée : déconnexion. */
  onAccountLost: () => void;
  /** Ouvert par « Changer de profil » plutôt qu'à l'ouverture (`switcher/switchPlan.ts`). */
  switching?: SwitchContext;
}

/**
 * « Qui regarde ? » sur le bureau — le CONTRÔLEUR, à l'ouverture comme depuis
 * « Changer de profil » : la liste (relue au serveur, la dernière connue
 * d'abord), le pavé du code PIN, l'entrée dans un profil (la tuile glisse au
 * centre, le rideau tombe, la page se recharge au nom du profil) et « Gérer
 * les profils » (son propre profil d'abord, derrière son code, puis Réglages ›
 * Famille). La vue est `WhoIsWatchingView`.
 *
 * « Ne plus proposer sur cet appareil » (si le compte demande qui regarde) :
 * cochée à l'arrivée si l'ordinateur retient encore un profil de la famille,
 * comme la TV ; le choix d'un profil la suit (retenu, ou plus rien) — sauf
 * « Gérer les profils », qui n'y touche pas.
 *
 * Depuis « Changer de profil » (`switching`) : « Annuler » et Échap referment
 * l'écran sans rien changer ; le focus arrive sur le profil en cours, la case
 * décochée ; ce profil-là choisi referme l'écran, sans code ; « Gérer les
 * profils » mène tout droit à la Famille depuis la session personnelle.
 */
export function ProfileLaunchScreen({ initialListing, ended = false, onDone, onAccountLost, switching }: ProfileLaunchScreenProps) {
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
  const [storedStay] = useState(() => readStayOnThisServer(accountId));
  // Depuis « Changer de profil », la case arrive décochée : le choix vaut pour un profil, jamais pour le suivant.
  const [stayChoice, setStayChoice] = useState<boolean | null>(switching ? false : null);
  const stay = stayChoice ?? (listing.data ? pickerStayChecked(listing.data, storedStay, Date.now()) : false);
  const stayRef = useRef(stay);
  stayRef.current = stay;
  const onToggleStay = useCallback(() => setStayChoice(!stayRef.current), []);
  const atLaunch = listing.data?.atLaunch === true;
  const atLaunchRef = useRef(atLaunch);
  atLaunchRef.current = atLaunch;
  const mode = switching ? "switch" : "launch";
  const leaveGroup = switching?.leaveGroup;

  const liftCurtain = useCallback(() => setCurtain(null), []);
  const onPicked = useCallback(async (picked: PickedProfileDto) => {
    // Une bascule qui échoue après la chute du rideau le relève : le refus se
    // dit sur le sélecteur (`usePickFlow`), jamais sous un rideau resté.
    const stayOnDevice = commitStay(mode, landing.current === FAMILY_SETTINGS_PATH, atLaunchRef.current, stayRef.current);
    const result = await commitPick(picked, { onCurtain: setCurtain, onCurtainLifted: liftCurtain, landing: landing.current, stayOnDevice, leaveGroup });
    if (result !== "stay") return;
    // L'application est déjà là, dessous : elle reprend sans rideau.
    if (mode === "switch") {
      onDone(landing.current);
      return;
    }
    // SON profil, sans rechargement : le rideau tombe sur le sélecteur, puis
    // l'application paraît dessous quand il se lève (`ProfileArrival`).
    announceArrival(curtainOf(picked.profile));
    await new Promise((resolve) => setTimeout(resolve, CURTAIN_FALL_MS));
    onDone(landing.current);
  }, [mode, onDone, liftCurtain, leaveGroup]);

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
  // Depuis la session personnelle ouverte, on est déjà dans son profil : tout droit.
  const own = profiles.find((profile) => profile.personal) ?? null;
  const activeId = switching ? switchActiveId(profiles, switching.activeProfileId) : null;
  const personalSession = switching?.activeProfileId === null;
  const { choose, back } = flow;
  const [lastChosen, setLastChosen] = useState<string | null>(null);
  const onManage = useCallback(() => {
    if (personalSession) {
      onDone(FAMILY_SETTINGS_PATH);
      return;
    }
    landing.current = FAMILY_SETTINGS_PATH;
    if (own) {
      setLastChosen(own.userId);
      choose(own.userId);
    }
  }, [personalSession, onDone, own, choose]);
  const onCancel = switching?.onCancel;
  const onPick = useCallback((profileId: string) => {
    landing.current = undefined;
    const plan = switchPick(profileId, activeId, atLaunchRef.current, stayRef.current);
    if (onCancel && plan.kind === "close") {
      const current = profiles.find((profile) => profile.userId === profileId);
      if (plan.keepHere && current && accountId) writeStayOnThisServer(accountId, pickerStayOf(current));
      onCancel();
      return;
    }
    setLastChosen(profileId);
    choose(profileId);
  }, [activeId, onCancel, profiles, accountId, choose]);
  const onBack = useCallback(() => {
    landing.current = undefined;
    back();
  }, [back]);

  const model = useMemo(
    () => pickerModelOf({
      listing: listing.data ?? null,
      error: listing.isError && !listing.data ? t("loadFailed") : null,
      flow: { ...flow, notice: flow.notice ?? (ended ? t("session.ended") : null) },
      // Le focus revient au dernier profil choisi ; depuis « Changer de profil », il part du profil en cours.
      lastChosen: lastChosen ?? activeId,
      openingLabel: slowOpening && flow.opening ? t("opening", { name: profiles.find((p) => p.userId === flow.opening)?.name ?? "" }) : null,
      language: i18n.language,
      t,
      stay,
    }),
    [listing.data, listing.isError, flow, ended, lastChosen, activeId, slowOpening, profiles, i18n.language, t, stay],
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
        onToggleStay={onToggleStay}
        onCancel={onCancel}
      />
      {curtain && <ProfileCurtain profile={curtain} phase="entering" />}
    </>
  );
}
