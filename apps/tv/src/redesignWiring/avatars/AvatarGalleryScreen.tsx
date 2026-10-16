import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import {
  AVATAR_GALLERY_DONE_MS,
  AVATAR_GALLERY_START,
  SELF_AVATAR_TARGET,
  avatarGalleryBackAction,
  avatarGalleryEntryKey,
  avatarGallerySections,
  avatarPickSettled,
  pickAvatar,
  type AvatarGalleryPhase,
  type AvatarGalleryTarget,
} from "@tentacle-tv/tv-core";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useAvatarGalleryEntry, useAvatarGalleryGroups } from "../../platform/tvos/screens/avatarGallery";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { AvatarGalleryView, type AvatarGalleryModel } from "../../redesign/screens/avatars/AvatarGalleryView";
import { useBackLayer } from "../back/BackScope";
import { avatarDisplaySources } from "./avatarImages";
import { useAvatarPhotoUpload } from "./useAvatarPhotoUpload";

export interface AvatarGalleryScreenProps {
  /** À qui va la photo : le sujet de la session (défaut), ou un invité de la Famille. */
  target?: AvatarGalleryTarget;
  /** La photo est posée (après la confirmation). */
  onDone: () => void;
  /** « Plus tard », ou Retour : rien n'a changé. */
  onSkip: () => void;
}

/**
 * La GALERIE DES AVATARS (Apple TV et Android TV) — l'écran, sans sa route :
 * les réglages le montent (« Changer la photo »), le parcours de première
 * entrée dans un profil aussi (sa troisième étape). Il ne sait pas d'où il
 * vient : il rend la main par `onDone` (la photo est posée) ou `onSkip`
 * (« Plus tard », Retour), UNE fois.
 *
 * Les décisions sont celles de tv-core (`avatars/avatarGallery`) : un envoi à
 * la fois, la confirmation, Retour retenu pendant l'envoi. Le focus est posé
 * par l'applicateur `platform/tvos/screens/avatarGallery.ts`.
 *
 * L'appelant le monte seulement face à un serveur qui déclare
 * `avatars.devicePhoto` (`useServerCapability`) : sinon le proxy refuserait.
 */
export function AvatarGalleryScreen({ target = SELF_AVATAR_TARGET, onDone, onSkip }: AvatarGalleryScreenProps) {
  const { storage } = useTentacleConfig();
  const serverUrl = storage.getItem("tentacle_server_url");
  const catalog = useMemo(() => avatarGallerySections(), []);
  const entryKey = useMemo(() => avatarGalleryEntryKey(catalog), [catalog]);
  const store = useFocusStore();
  useAvatarGalleryGroups(store, catalog, entryKey);
  useAvatarGalleryEntry(store, entryKey);
  const send = useAvatarPhotoUpload(target);

  // Une seule sortie, quel que soit le geste.
  const exits = useRef({ onDone, onSkip });
  exits.current = { onDone, onSkip };
  const left = useRef(false);
  const leave = useCallback((how: "done" | "skip") => {
    if (left.current) return;
    left.current = true;
    if (how === "done") exits.current.onDone();
    else exits.current.onSkip();
  }, []);

  // L'état relu par les gestes eux-mêmes : deux OK dans la même image ne partent pas deux fois.
  const [phase, setPhase] = useState<AvatarGalleryPhase>(AVATAR_GALLERY_START);
  const current = useRef(phase);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const settle = useCallback((next: AvatarGalleryPhase) => {
    current.current = next;
    setPhase(next);
  }, []);

  const onPick = useCallback(
    (id: string) => {
      const next = pickAvatar(current.current, id);
      if (next === current.current) return;
      settle(next);
      void send(id).then((sent) => {
        if (alive.current) settle(avatarPickSettled(current.current, sent));
      });
    },
    [send, settle],
  );

  // Fait : la confirmation un instant, puis la main rendue.
  useEffect(() => {
    if (phase.kind !== "done") return undefined;
    const timer = setTimeout(() => leave("done"), AVATAR_GALLERY_DONE_MS);
    return () => clearTimeout(timer);
  }, [phase, leave]);

  const onLater = useCallback(() => {
    if (avatarGalleryBackAction(current.current) === "skip") leave("skip");
  }, [leave]);
  useBackLayer("page", true, onLater);

  const sections = useMemo(
    () =>
      catalog.map((section) => ({
        collection: section.collection,
        characters: section.characters.map((character) => ({
          id: character.id,
          tone: character.tone,
          temperament: character.temperament,
          ...avatarDisplaySources(serverUrl, character.id),
        })),
      })),
    [catalog, serverUrl],
  );
  const guestName = target.kind === "guest" ? target.name : null;
  const model = useMemo<AvatarGalleryModel>(() => ({ guestName, sections, phase }), [guestName, sections, phase]);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <AvatarGalleryView model={model} onPick={onPick} onLater={onLater} />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
