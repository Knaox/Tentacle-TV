import {
  Activity, Bell, CircleHelp, CirclePlay, Info, LifeBuoy, Lock, Mail, MessageSquare, Repeat, Shield,
  SlidersHorizontal, Smartphone, Trash2, Tv, User, UserX, Users, WifiOff, type LucideIcon,
} from "lucide-react";

/**
 * Les icônes du catalogue des réglages sont des noms Feather (ceux de l'app
 * mobile) ; le web dessine en Lucide. Cette table les fait correspondre — une
 * icône nouvelle dans le catalogue s'ajoute ici, le test le vérifie
 * (`webCoverage.test.ts`).
 */
export const CATALOG_ICONS: Readonly<Record<string, LucideIcon>> = {
  activity: Activity,
  bell: Bell,
  "help-circle": CircleHelp,
  info: Info,
  "life-buoy": LifeBuoy,
  lock: Lock,
  mail: Mail,
  "message-square": MessageSquare,
  "play-circle": CirclePlay,
  repeat: Repeat,
  shield: Shield,
  sliders: SlidersHorizontal,
  smartphone: Smartphone,
  "trash-2": Trash2,
  tv: Tv,
  user: User,
  "user-x": UserX,
  users: Users,
  "wifi-off": WifiOff,
};

/** L'icône Lucide d'un nom Feather du catalogue (repli : `Info`, jamais une case vide). */
export function catalogIcon(name: string): LucideIcon {
  return CATALOG_ICONS[name] ?? Info;
}
