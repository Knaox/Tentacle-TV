import { memo, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import {
  OPENING_HINT_DELAY_MS,
  PROFILES_ACTIONS_GROUP,
  PROFILES_MANAGE_KEY,
  PROFILES_STAY_KEY,
  PROFILES_TILES_GROUP,
  profileTileKey,
} from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusSection } from "../../focus/FocusSection";
import { useEntrance, useMotion } from "../../motion/useMotion";
import { colors, text } from "../../theme/tokens";
import { ProfileTile, TILE_GAP, type TileEntrance } from "./ProfileTile";
import { StayToggle } from "./StayToggle";
import type { ProfilesViewModel } from "./profilesTypes";

type PickerModel = Extract<ProfilesViewModel, { kind: "picker" }>;

/**
 * La rangée de « Qui regarde ? » : les profils, la case « Ne plus proposer à
 * l'ouverture », « Gérer les profils ». Elle joue l'ENTRÉE dans un profil
 * (`model.entering`) : le choisi s'avance et grandit, le reste s'efface
 * (titre, voisins, actions) pendant que la session s'ouvre ; refusée, tout
 * revient. Seul le choisi reste une cible pendant ce temps. Si le serveur
 * tarde, « Ouverture de Léa… » paraît sous lui.
 */
export const ProfilesPicker = memo(function ProfilesPicker({ model, onPick, onTileFocus, onToggleRemember, onManage }: {
  model: PickerModel;
  onPick?: (index: number) => void;
  onTileFocus: (index: number, focused: boolean) => void;
  onToggleRemember?: () => void;
  onManage?: () => void;
}) {
  const { t } = useTranslation(["familyTv", "preferences"]);
  const enteringIndex = model.entering?.index ?? null;
  const entering = enteringIndex !== null;
  const reduced = useReducedMotion();

  // Le choisi de la DERNIÈRE entrée : le retour d'une entrée refusée se joue avec les mêmes rôles.
  const chosen = useSharedValue(-1);
  const [front, setFront] = useState<number | null>(null);
  if (enteringIndex !== null && front !== enteringIndex) setFront(enteringIndex);
  useLayoutEffect(() => {
    if (enteringIndex !== null) chosen.value = enteringIndex;
  }, [enteringIndex, chosen]);
  const progress = useMotion(entering, "advance");
  const entrance = useMemo<TileEntrance>(
    () => ({ progress, chosen, count: model.profiles.length, still: reduced }),
    [progress, chosen, model.profiles.length, reduced],
  );
  // Le reste part plus vite que le choisi n'arrive.
  const chrome = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP) }));

  return (
    <View style={styles.center}>
      <Animated.Text style={[styles.title, chrome]}>{t("familyTv:whoIsWatching")}</Animated.Text>
      <FocusSection focusKey={PROFILES_TILES_GROUP} style={styles.tiles}>
        {model.profiles.map((profile, index) => (
          <ProfileTile
            key={profile.id}
            model={profile}
            index={index}
            focusKey={profileTileKey(index)}
            entrance={entrance}
            front={front === index}
            disabled={entering && index !== enteringIndex}
            onPress={onPick ? () => onPick(index) : undefined}
            onFocusChange={(focused) => onTileFocus(index, focused)}
          />
        ))}
      </FocusSection>
      <View style={styles.lower}>
        <Animated.View style={chrome}>
          <View style={styles.notice}>
            {model.notice ? <Text style={styles.noticeText}>{model.notice}</Text> : null}
          </View>
          <FocusSection focusKey={PROFILES_ACTIONS_GROUP} style={styles.actions}>
            <StayToggle
              label={t("familyTv:stayOnProfile")}
              checked={model.remember}
              focusKey={PROFILES_STAY_KEY}
              accessibilityLabel={`${t("familyTv:stayOnProfile")} : ${t(model.remember ? "preferences:reglageActive" : "preferences:reglageDesactive")}`}
              disabled={entering}
              onPress={onToggleRemember}
            />
            {model.canManage ? (
              <PillButton label={t("familyTv:manageProfiles")} icon="settings" size="md" focusKey={PROFILES_MANAGE_KEY} disabled={entering} onPress={onManage} />
            ) : null}
          </FocusSection>
          <Text style={styles.hint}>{model.remember ? t("familyTv:stayOnProfileHint") : " "}</Text>
        </Animated.View>
        {model.entering ? <OpeningHint label={model.entering.label} /> : null}
      </View>
    </View>
  );
});

/** « Ouverture de Léa… » — seulement si le serveur tarde : il attend (une
 *  minuterie, pas l'animation — animations réduites, il attend aussi), puis paraît. */
function OpeningHint({ label }: { label: string }) {
  const [due, setDue] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDue(true), OPENING_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return due ? <OpeningLine label={label} /> : null;
}

function OpeningLine({ label }: { label: string }) {
  const p = useEntrance("reveal");
  const style = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.opening, style]}>
      <Text style={styles.openingText} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
}

const NOTICE_HEIGHT = 70;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: TV_STAGE.safe.x },
  title: { ...text.display, textAlign: "center", marginBottom: 72 },
  tiles: { flexDirection: "row", gap: TILE_GAP, justifyContent: "center" },
  // Pleine largeur, comme les actions qu'il porte.
  lower: { alignSelf: "stretch" },
  notice: { height: NOTICE_HEIGHT, justifyContent: "center" },
  noticeText: { ...text.body, color: colors.warningFg, textAlign: "center" },
  // Pleine largeur : BAS depuis le profil le plus à droite (ou à gauche) y trouve une cible.
  actions: { flexDirection: "row", gap: 28, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  hint: { ...text.caption, marginTop: 22, textAlign: "center" },
  // À la place des actions effacées : sous le profil agrandi, sans le toucher.
  opening: { position: "absolute", top: NOTICE_HEIGHT, left: 0, right: 0, height: 56, alignItems: "center", justifyContent: "center" },
  openingText: { ...text.body, color: colors.textSecondary, textAlign: "center" },
});
