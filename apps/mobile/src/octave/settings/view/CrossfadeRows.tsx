/**
 * Octave (mobile) — « Transition douce » dans les Réglages d'Octave : l'interrupteur, puis la durée du fondu
 * (2 à 12 s, crans d'une seconde) quand elle est allumée — la même ligne que le bureau, sur le même réglage que
 * le contrôle du lecteur (`../crossfadeStore.ts`). Le curseur suit le doigt en local et n'écrit qu'au relâcher.
 */

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SteppedSlider } from "@/components/settings";
import { spacing } from "@/theme";
import { CROSSFADE_DEFAULT_MS, CROSSFADE_MAX_S, CROSSFADE_MIN_S, setCrossfadeMs, useCrossfadeMs } from "../crossfadeStore";
import { SwitchRow } from "./SwitchRow";

export function CrossfadeRows() {
  const { t } = useTranslation("octaveShell");
  const ms = useCrossfadeMs();
  const on = ms > 0;
  const [seconds, setSeconds] = useState(on ? ms / 1000 : CROSSFADE_DEFAULT_MS / 1000);
  useEffect(() => {
    if (ms > 0) setSeconds(ms / 1000);
  }, [ms]);
  return (
    <>
      <SwitchRow
        icon="shuffle"
        label={t("crossfade.label")}
        description={t("crossfade.hint")}
        value={on}
        onChange={(next) => setCrossfadeMs(next ? CROSSFADE_DEFAULT_MS : 0)}
        last={!on}
      />
      {on && (
        <View style={styles.slider}>
          <SteppedSlider
            value={seconds}
            min={CROSSFADE_MIN_S}
            max={CROSSFADE_MAX_S}
            step={1}
            onChange={setSeconds}
            onChangeEnd={(value) => setCrossfadeMs(value * 1000)}
            accessibilityLabel={t("crossfade.duration")}
            valueText={t("crossfade.seconds", { count: seconds })}
            leftLabel={t("crossfade.seconds", { count: CROSSFADE_MIN_S })}
            rightLabel={t("crossfade.seconds", { count: CROSSFADE_MAX_S })}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  slider: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md },
});
