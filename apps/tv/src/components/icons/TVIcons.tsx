import { View } from "react-native";

const C = "#c4b5fd"; // default icon color
const S = 24; // default size

interface IconProps {
  size?: number;
  color?: string;
}

/** Simple house icon */
export function HomeIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      {/* Roof triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: s * 0.5,
          borderRightWidth: s * 0.5,
          borderBottomWidth: s * 0.38,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          marginBottom: -1,
        }}
      />
      {/* House body */}
      <View
        style={{
          width: s * 0.7,
          height: s * 0.4,
          backgroundColor: color,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}
      />
    </View>
  );
}

/** Magnifying glass icon */
export function SearchIcon({ size = S, color = C }: IconProps) {
  const s = size;
  const r = s * 0.32;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      {/* Circle */}
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: s * 0.1,
          borderColor: color,
          position: "absolute",
          top: s * 0.08,
          left: s * 0.08,
        }}
      />
      {/* Handle */}
      <View
        style={{
          width: s * 0.1,
          height: s * 0.35,
          backgroundColor: color,
          borderRadius: s * 0.05,
          position: "absolute",
          bottom: s * 0.04,
          right: s * 0.14,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

/** Library/folder icon */
export function LibraryIcon({ size = S, color = C }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s, justifyContent: "center", alignItems: "center" }}>
      {/* Folder tab */}
      <View
        style={{
          width: s * 0.4,
          height: s * 0.15,
          backgroundColor: color,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          alignSelf: "flex-start",
          marginLeft: s * 0.08,
          marginBottom: -1,
        }}
      />
      {/* Folder body */}
      <View
        style={{
          width: s * 0.84,
          height: s * 0.55,
          backgroundColor: color,
          borderRadius: 3,
          opacity: 0.85,
        }}
      />
    </View>
  );
}

/** Settings/gear-like icon (dots) */
export function SettingsIcon({ size = S, color = C }: IconProps) {
  const s = size;
  const dot = s * 0.18;
  return (
    <View
      style={{
        width: s,
        height: s,
        justifyContent: "space-evenly",
        alignItems: "center",
        paddingVertical: s * 0.15,
      }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
