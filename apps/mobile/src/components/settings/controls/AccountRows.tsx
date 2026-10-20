import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { profilePhotoUrl } from "@/auth/storedUser";
import { useStoredUser } from "@/auth/useStoredUser";
import { AvatarGallerySheet } from "@/avatars/gallery/AvatarGallerySheet";
import { RADIUS, useThemedStyles, type AppTheme } from "@/theme";
import type { SettingScope } from "../ScopeBadge";
import { SettingsRow } from "../SettingsRow";

interface RowProps {
  scope: SettingScope | null;
  last?: boolean;
}

/** La route de « Qui regarde ? » (premier lancement de la Famille mobile). */
export const WHO_IS_WATCHING_HREF = "/who-is-watching";

/**
 * « Photo de profil » — la photo du COMPTE Jellyfin : la galerie des
 * personnages ou une photo importée, comme le toucher de l'avatar en tête.
 */
export function PhotoRow({ scope, last }: RowProps) {
  const { t } = useTranslation(["settingsMobile", "profile"]);
  const st = useThemedStyles(makeStyles);
  const { storage } = useTentacleConfig();
  const user = useStoredUser();
  const [open, setOpen] = useState(false);
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const name = user?.Name ?? t("profile:defaultUsername");
  const uri = user?.Id ? profilePhotoUrl(serverUrl, user.Id, user.PrimaryImageTag ?? null) : null;
  const current = useMemo(() => ({ uri, initial: name.charAt(0).toUpperCase() }), [uri, name]);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <SettingsRow
        icon="camera"
        label={t("account.photo")}
        description={t("account.photoHint")}
        scope={scope ?? undefined}
        chevron
        last={last}
        accessibilityLabel={t("profile:changePhoto")}
        onPress={() => setOpen(true)}
        trailing={uri ? <View style={st.thumbWrap}><Image source={{ uri }} style={st.thumb} contentFit="cover" /></View> : undefined}
      />
      <AvatarGallerySheet visible={open} mode="change" current={current} onClose={close} />
    </>
  );
}

/** Le nom du compte, en lecture : il se change dans Jellyfin, par un administrateur. */
export function UserNameRow({ last }: RowProps) {
  const { t } = useTranslation(["settingsMobile", "profile"]);
  const user = useStoredUser();
  return <SettingsRow icon="at-sign" label={t("account.name")} value={user?.Name ?? t("profile:defaultUsername")} last={last} />;
}

/** « Changer de profil » : « Qui regarde ? », là où la famille a plusieurs profils. */
export function SwitchProfileRow({ last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  const router = useRouter();
  return (
    <SettingsRow icon="refresh-cw" label={t("account.switchProfile")} chevron last={last} onPress={() => router.push(WHO_IS_WATCHING_HREF as Href)} />
  );
}

/**
 * « Réglages avancés : sur l'app bureau » — un renvoi, pas un réglage : ce qui
 * est trop fin pour un téléphone se règle sur le bureau, dans le COMPTE, et
 * s'applique donc ici aussitôt. Le toucher explique quoi, sans quitter l'app.
 */
export function AdvancedOnDesktopRow({ last }: RowProps) {
  const { t } = useTranslation("settingsMobile");
  return (
    <SettingsRow
      icon="monitor"
      label={t("advanced.row")}
      description={t("advanced.rowHint")}
      last={last}
      onPress={() => Alert.alert(t("advanced.title"), t("advanced.body"))}
    />
  );
}

const THUMB = 32;

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    thumbWrap: { borderRadius: RADIUS.pill, overflow: "hidden" },
    thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: t.colors.fill.subtle },
  });
