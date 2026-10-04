import { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PROFILES_BACK_BAR_KEY, PROFILES_BACK_KEY } from "@tentacle-tv/tv-core";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { StatusPanel } from "../shared/StatusPanel";
import { PinPad } from "./PinPad";
import { PROFILES_PALETTE, profilePalette } from "./profileColors";
import { ProfilesPicker } from "./ProfilesPicker";
import type { ProfilesViewProps } from "./profilesTypes";

export type { PinPadModel, ProfileTileModel, ProfilesViewModel, ProfilesViewProps } from "./profilesTypes";

/**
 * « Qui regarde ? » (`Profiles`, Apple TV, Famille) — la page qui ouvre l'app
 * (sauf un profil retenu), et à laquelle on revient en changeant de profil. Aucun
 * logo : la marque est dans la lumière, qui prend la couleur du profil
 * focalisé. Quatre visages, que l'intégration choisit (`model`) :
 * - `loading` : la lecture des profils, ou l'ouverture de l'un d'eux ;
 * - `error` : les profils illisibles — Réessayer, et un second geste ;
 * - `picker` : la rangée des profils (six au plus), la case discrète « Ne
 *   plus proposer à l'ouverture » et « Gérer les profils » dessous ;
 * - `pin` : le pavé du code du profil choisi, sa croix Retour en haut à
 *   gauche, comme partout.
 *
 * Clés : `profiles:tile:<i>`, `profiles:stay`, `profiles:manage`,
 * `profiles:back` ; groupes `profiles:tiles`, `profiles:actions`,
 * `profiles:top` ; le pavé (`PinPad`) ; `status:primary` / `status:secondary`.
 */
export const ProfilesView = memo(function ProfilesView(props: ProfilesViewProps) {
  const { model } = props;
  const { t } = useTranslation(["familyTv", "common", "preferences"]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedColor = model.kind === "picker" && focusedIndex !== null ? model.profiles[focusedIndex]?.color : null;
  const pinColor = model.kind === "pin" ? model.pad.profile.color : null;
  const color = focusedColor ?? pinColor;
  const palette = useMemo(() => (color ? profilePalette(color) : PROFILES_PALETTE), [color]);
  const { onFocusProfile } = props;
  const onTileFocus = useCallback((index: number, focused: boolean) => {
    if (focused) {
      setFocusedIndex(index);
      onFocusProfile?.(index);
    } else setFocusedIndex((current) => (current === index ? null : current));
  }, [onFocusProfile]);

  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} intensity={1.1} />
      <Animated.View key={model.kind} entering={FadeIn.duration(260)} style={styles.fill}>
        {model.kind === "loading" ? <StatusPanel kind="loading" title={model.label} inset={0} /> : null}
        {model.kind === "error" ? (
          <StatusPanel
            kind="error"
            title={t("familyTv:loadFailed")}
            message={model.message}
            inset={0}
            primary={{ label: t("common:retry"), icon: "refresh", onPress: props.onRetry }}
            secondary={model.secondary ? { label: model.secondary.label, icon: "logout", onPress: props.onErrorSecondary } : undefined}
          />
        ) : null}
        {model.kind === "picker" ? (
          <ProfilesPicker
            model={model}
            onPick={props.onPick}
            onTileFocus={onTileFocus}
            onToggleRemember={props.onToggleRemember}
            onManage={props.onManage}
          />
        ) : null}
        {model.kind === "pin" ? (
          <>
            <View style={styles.center}>
              <PinPad pad={model.pad} onDigit={props.onDigit} onErase={props.onErase} />
            </View>
            <FocusGroup focusKey={PROFILES_BACK_BAR_KEY} style={styles.backBar}>
              <BackButton focusKey={PROFILES_BACK_KEY} onPress={props.onBack} />
            </FocusGroup>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: TV_STAGE.safe.x },
  // En haut à gauche, sur toute la largeur : HAUT depuis le pavé y monte.
  backBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACK_TOP + BACK_BUTTON_SIZE,
    paddingTop: BACK_TOP,
    paddingLeft: TV_STAGE.safe.x,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
