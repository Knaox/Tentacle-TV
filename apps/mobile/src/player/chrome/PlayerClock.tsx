import { memo, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from "lucide-react-native";
import { PLAYER } from "@/theme";
import { getBatteryStatus, type BatteryStatus } from "../../../modules/mpv-player";

/** Prochaine minute pleine : l'heure change à l'instant où celle du système change. */
function msToNextMinute(now: Date): number {
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function BatteryIcon({ status, size }: { status: BatteryStatus; size: number }) {
  const color = status.level <= 0.15 && !status.charging ? PLAYER.error : PLAYER.text;
  if (status.charging) return <BatteryCharging size={size} color={color} />;
  if (status.level >= 0.9) return <BatteryFull size={size} color={color} />;
  if (status.level >= 0.5) return <BatteryMedium size={size} color={color} />;
  if (status.level >= 0.2) return <BatteryLow size={size} color={color} />;
  return <Battery size={size} color={color} />;
}

/**
 * L'heure et la batterie dessinées par le lecteur, là où le système refuse sa
 * barre d'état (iPhone en paysage, cf. `statusBarPlan`). Monté seulement avec
 * les commandes : rien ne tourne quand elles sont masquées.
 */
export const PlayerClock = memo(function PlayerClock({ ui }: { ui: number }) {
  const [now, setNow] = useState(() => new Date());
  const [battery, setBattery] = useState<BatteryStatus | null>(() => getBatteryStatus());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(date);
      setBattery(getBatteryStatus());
      timer = setTimeout(tick, msToNextMinute(date));
    };
    timer = setTimeout(tick, msToNextMinute(new Date()));
    return () => clearTimeout(timer);
  }, []);
  const fontSize = Math.round(14 * ui);
  return (
    <View
      accessible
      accessibilityLabel={battery ? `${formatClock(now)}, ${Math.round(battery.level * 100)} %` : formatClock(now)}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <Text style={{ color: PLAYER.text, fontSize, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{formatClock(now)}</Text>
      {battery && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text style={{ color: PLAYER.textSecondary, fontSize: fontSize - 2, fontVariant: ["tabular-nums"] }}>
            {Math.round(battery.level * 100)} %
          </Text>
          <BatteryIcon status={battery} size={Math.round(18 * ui)} />
        </View>
      )}
    </View>
  );
});
