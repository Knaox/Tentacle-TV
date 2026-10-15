import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { MOTION_ENABLED } from "../../motion/motion";
import { PROFILES_PALETTE } from "../profiles/profileColors";
import { RailSetupApply } from "./RailSetupApply";
import { RailSetupLibraries } from "./RailSetupLibraries";
import type { RailSetupViewProps } from "./railSetupTypes";

export type { RailPreviewEntry, RailSetupLibrary, RailSetupModel, RailSetupTarget, RailSetupViewProps } from "./railSetupTypes";

/**
 * La PRÉCONFIGURATION de la barre (`RailSetup`, Apple TV et Android TV) —
 * une fois par profil et par appareil, avant l'accueil : « Quelles
 * bibliothèques dans votre barre ? ». Pas de barre ici : son APERÇU tient sa
 * place. Aucun logo, la lumière neutre de « Qui regarde ? » ; la marque en
 * touches seulement (la case cochée, le liseré d'un déplacement).
 *
 * Trois visages, que l'intégration choisit (`model`) :
 * - `waiting` : le socle ne sait pas encore — la lumière seule, rien à lire ;
 * - `libraries` : la liste, l'aperçu, « Continuer » et « Passer » ;
 * - `apply` : l'étape du propriétaire, « Appliquer aussi à d'autres profils ? ».
 *
 * Aucune croix : Retour vaut « Passer » (ou « Non merci »), décidé par
 * l'intégration (tv-core `railSetupBackAction`).
 *
 * Clés : `railSetup:row:<i>`, `railSetup:row:<i>:move`, `railSetup:continue`,
 * `railSetup:skip` ; `railSetup:applyTile:<i>`, `railSetup:applyConfirm`,
 * `railSetup:applyDecline` ; groupes `railSetup:list`, `railSetup:actions`,
 * `railSetup:applyTiles`, `railSetup:applyActions`.
 */
export const RailSetupView = memo(function RailSetupView(props: RailSetupViewProps) {
  const { model } = props;
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={PROFILES_PALETTE} intensity={1.1} />
      {model.kind === "waiting" ? null : (
        <Animated.View key={model.kind} entering={MOTION_ENABLED ? FadeIn.duration(260) : undefined} style={styles.fill}>
          {model.kind === "libraries" ? (
            <RailSetupLibraries
              model={model}
              onTogglePin={props.onTogglePin}
              onMove={props.onMove}
              onContinue={props.onContinue}
              onSkip={props.onSkip}
            />
          ) : (
            <RailSetupApply model={model} onToggleTarget={props.onToggleTarget} onApply={props.onApply} onDecline={props.onDecline} />
          )}
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
