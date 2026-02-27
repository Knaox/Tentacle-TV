import { View, Text } from "react-native";

const C = "#c4b5fd";
const S = 24;

interface IconProps {
  size?: number;
  color?: string;
}

/** House icon with door */
export function HomeIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: s * 0.52, borderRightWidth: s * 0.52,
        borderBottomWidth: s * 0.36,
        borderLeftColor: "transparent", borderRightColor: "transparent",
        borderBottomColor: color, marginBottom: -2,
      }} />
      <View style={{
        width: s * 0.72, height: s * 0.42, backgroundColor: color,
        borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
        justifyContent: "flex-end", alignItems: "center", paddingBottom: 1,
      }}>
        <View style={{
          width: s * 0.22, height: s * 0.22,
          backgroundColor: "#0a0a0f", borderTopLeftRadius: 2, borderTopRightRadius: 2,
        }} />
      </View>
    </View>
  );
}

/** Magnifying glass */
export function SearchIcon({ size = S, color = C }: IconProps) {
  const s = size;
  const r = s * 0.3;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: r * 2, height: r * 2, borderRadius: r,
        borderWidth: s * 0.1, borderColor: color,
        position: "absolute", top: s * 0.06, left: s * 0.06,
      }} />
      <View style={{
        width: s * 0.1, height: s * 0.32, backgroundColor: color,
        borderRadius: s * 0.05,
        position: "absolute", bottom: s * 0.04, right: s * 0.12,
        transform: [{ rotate: "45deg" }],
      }} />
    </View>
  );
}

/** Film clapperboard icon */
export function MovieIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.82, height: s * 0.22, backgroundColor: color,
        borderTopLeftRadius: 3, borderTopRightRadius: 3,
        flexDirection: "row", overflow: "hidden",
      }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{
            width: s * 0.08, height: "100%", backgroundColor: "#0a0a0f",
            marginLeft: i === 0 ? s * 0.06 : s * 0.1,
            transform: [{ skewX: "-15deg" }],
          }} />
        ))}
      </View>
      <View style={{
        width: s * 0.82, height: s * 0.46, backgroundColor: color,
        borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
        opacity: 0.8, marginTop: 1,
      }} />
    </View>
  );
}

/** Gear settings icon */
export function SettingsIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.52, height: s * 0.52, borderRadius: s * 0.26,
        borderWidth: s * 0.08, borderColor: color,
      }} />
      <View style={{
        position: "absolute",
        width: s * 0.16, height: s * 0.16, borderRadius: s * 0.08,
        backgroundColor: color,
      }} />
      {[0, 45, 90, 135].map((deg) => (
        <View key={deg} style={{
          position: "absolute",
          width: s * 0.14, height: s * 0.84,
          justifyContent: "space-between", alignItems: "center",
          transform: [{ rotate: `${deg}deg` }],
        }}>
          <View style={{ width: s * 0.14, height: s * 0.12, backgroundColor: color, borderRadius: 2 }} />
          <View style={{ width: s * 0.14, height: s * 0.12, backgroundColor: color, borderRadius: 2 }} />
        </View>
      ))}
    </View>
  );
}

/** Info (i) in circle */
export function InfoIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{
      width: s, height: s, justifyContent: "center", alignItems: "center",
      borderRadius: s / 2, borderWidth: s * 0.08, borderColor: color,
    }}>
      <Text style={{
        color, fontSize: s * 0.48, fontWeight: "800",
        fontStyle: "italic", marginTop: -s * 0.02,
      }}>
        i
      </Text>
    </View>
  );
}

/** Logout exit arrow */
export function LogoutIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.5, height: s * 0.76,
        borderTopWidth: s * 0.08, borderBottomWidth: s * 0.08, borderLeftWidth: s * 0.08,
        borderColor: color, borderTopLeftRadius: 3, borderBottomLeftRadius: 3,
        position: "absolute", left: s * 0.06,
      }} />
      <View style={{
        width: s * 0.36, height: s * 0.08, backgroundColor: color,
        position: "absolute", right: s * 0.1,
      }} />
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.16, borderBottomWidth: s * 0.16, borderLeftWidth: s * 0.18,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderLeftColor: color,
        position: "absolute", right: s * 0.04,
      }} />
    </View>
  );
}

/** Tentacle logo T */
export function TentacleIcon({ size = 32, color = "#8b5cf6" }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.7, height: s * 0.14, backgroundColor: color,
        borderRadius: s * 0.07, position: "absolute", top: s * 0.12,
      }} />
      <View style={{
        width: s * 0.18, height: s * 0.58, backgroundColor: color,
        borderRadius: s * 0.09, position: "absolute", top: s * 0.18,
      }} />
      <View style={{
        width: s * 0.28, height: s * 0.14,
        borderBottomWidth: s * 0.1, borderRightWidth: s * 0.1,
        borderColor: color, borderBottomRightRadius: s * 0.14,
        position: "absolute", bottom: s * 0.08, left: s * 0.38,
      }} />
    </View>
  );
}

/** TV screen icon */
export function TVIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.82, height: s * 0.56,
        borderWidth: s * 0.08, borderColor: color,
        borderRadius: 4,
      }} />
      <View style={{
        width: s * 0.36, height: s * 0.08, backgroundColor: color,
        borderRadius: 2, marginTop: 2,
      }} />
    </View>
  );
}

/** Music note icon */
export function MusicIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.08, height: s * 0.6, backgroundColor: color,
        position: "absolute", right: s * 0.28, top: s * 0.1,
      }} />
      <View style={{
        width: s * 0.24, height: s * 0.08, backgroundColor: color,
        position: "absolute", right: s * 0.12, top: s * 0.1,
        transform: [{ rotate: "-20deg" }],
      }} />
      <View style={{
        width: s * 0.2, height: s * 0.2, borderRadius: s * 0.1,
        backgroundColor: color,
        position: "absolute", left: s * 0.22, bottom: s * 0.14,
      }} />
    </View>
  );
}

/** Book icon */
export function BookIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.6, height: s * 0.72,
        borderWidth: s * 0.06, borderColor: color,
        borderRadius: 3, borderTopRightRadius: 0, borderBottomRightRadius: 0,
      }} />
      <View style={{
        position: "absolute",
        width: s * 0.06, height: s * 0.72,
        backgroundColor: color,
        right: s * 0.2,
      }} />
    </View>
  );
}

/** Play icon (triangle) */
export function PlayIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.3, borderBottomWidth: s * 0.3, borderLeftWidth: s * 0.5,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderLeftColor: color,
        marginLeft: s * 0.08,
      }} />
    </View>
  );
}

/** Pause icon (two bars) */
export function PauseIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: s * 0.14 }}>
      <View style={{ width: s * 0.18, height: s * 0.56, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ width: s * 0.18, height: s * 0.56, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

/** Back arrow icon */
export function BackIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.24, borderBottomWidth: s * 0.24, borderRightWidth: s * 0.32,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderRightColor: color,
        marginRight: s * 0.1,
      }} />
      <View style={{
        width: s * 0.36, height: s * 0.08, backgroundColor: color,
        position: "absolute", right: s * 0.18,
        borderRadius: 1,
      }} />
    </View>
  );
}

/** Skip forward icon (double arrow right) */
export function SkipForwardIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center", flexDirection: "row" }}>
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.2, borderBottomWidth: s * 0.2, borderLeftWidth: s * 0.24,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderLeftColor: color,
      }} />
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.2, borderBottomWidth: s * 0.2, borderLeftWidth: s * 0.24,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderLeftColor: color,
        marginLeft: -s * 0.04,
      }} />
    </View>
  );
}

/** Skip backward icon (double arrow left) */
export function SkipBackIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center", flexDirection: "row" }}>
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.2, borderBottomWidth: s * 0.2, borderRightWidth: s * 0.24,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderRightColor: color,
      }} />
      <View style={{
        width: 0, height: 0,
        borderTopWidth: s * 0.2, borderBottomWidth: s * 0.2, borderRightWidth: s * 0.24,
        borderTopColor: "transparent", borderBottomColor: "transparent",
        borderRightColor: color,
        marginLeft: -s * 0.04,
      }} />
    </View>
  );
}

/** Checkmark icon */
export function CheckIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{
        width: s * 0.28, height: s * 0.5,
        borderBottomWidth: s * 0.1, borderRightWidth: s * 0.1,
        borderColor: color,
        transform: [{ rotate: "40deg" }],
        marginTop: -s * 0.08,
      }} />
    </View>
  );
}

/** Three horizontal lines (hamburger menu) */
export function MenuIcon({ size = S, color = C }: IconProps) {
  const s = size;
  const barH = Math.max(2, s * 0.1);
  const gap = s * 0.2;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      <View style={{ width: s * 0.7, height: barH, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: s * 0.7, height: barH, backgroundColor: color, borderRadius: 1, marginTop: gap }} />
      <View style={{ width: s * 0.7, height: barH, backgroundColor: color, borderRadius: 1, marginTop: gap }} />
    </View>
  );
}

export const LibraryIcon = MovieIcon;
