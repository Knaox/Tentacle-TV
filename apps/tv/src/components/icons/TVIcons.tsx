import { View } from "react-native";
import Svg, { Path, Rect, Line, Circle, Polyline } from "react-native-svg";

const C = "#c4b5fd";
const S = 24;

interface IconProps {
  size?: number;
  color?: string;
}

export function HomeIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

export function SearchIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function MovieIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect width={18} height={18} x={3} y={3} rx={2} />
      <Path d="M7 3v18" />
      <Path d="M3 7.5h4" />
      <Path d="M3 12h18" />
      <Path d="M3 16.5h4" />
      <Path d="M17 3v18" />
      <Path d="M17 7.5h4" />
      <Path d="M17 16.5h4" />
    </Svg>
  );
}

export function SettingsIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

export function InfoIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </Svg>
  );
}

export function LogoutIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1={21} x2={9} y1={12} y2={12} />
    </Svg>
  );
}

export function TVIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect width={20} height={15} x={2} y={7} rx={2} ry={2} />
      <Polyline points="17 2 12 7 7 2" />
    </Svg>
  );
}

export function MusicIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18V5l12-2v13" />
      <Circle cx={6} cy={18} r={3} />
      <Circle cx={18} cy={16} r={3} />
    </Svg>
  );
}

export function BookIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 7v14" />
      <Path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Svg>
  );
}

export function PlayIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m6 3 14 9-14 9z" />
    </Svg>
  );
}

export function PauseIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={14} y={4} width={4} height={16} rx={1} />
      <Rect x={6} y={4} width={4} height={16} rx={1} />
    </Svg>
  );
}

export function BackIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function SkipForwardIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m5 4 10 8-10 8z" />
      <Line x1={19} x2={19} y1={5} y2={19} />
    </Svg>
  );
}

export function SkipBackIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 20 9 12l10-8z" />
      <Line x1={5} x2={5} y1={19} y2={5} />
    </Svg>
  );
}

export function NextTrackIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M4 4l12 8-12 8V4z" />
      <Rect x={18} y={5} width={2} height={14} rx={1} />
    </Svg>
  );
}

export function PrevTrackIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M20 4L8 12l12 8V4z" />
      <Rect x={4} y={5} width={2} height={14} rx={1} />
    </Svg>
  );
}

export function CheckIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function MenuIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1={4} x2={20} y1={12} y2={12} />
      <Line x1={4} x2={20} y1={6} y2={6} />
      <Line x1={4} x2={20} y1={18} y2={18} />
    </Svg>
  );
}

export function BookmarkIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function BookmarkFilledIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

/** Tentacle logo T — custom */
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

export function MicIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1={12} x2={12} y1={19} y2={22} />
    </Svg>
  );
}

export function CloseIcon({ size = S, color = C }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export const LibraryIcon = MovieIcon;
