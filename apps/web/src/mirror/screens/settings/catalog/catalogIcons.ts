import { PulseIcon as Activity } from "@phosphor-icons/react/dist/csr/Pulse";
import { BellIcon as Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { QuestionIcon as CircleHelp } from "@phosphor-icons/react/dist/csr/Question";
import { PlayCircleIcon as CirclePlay } from "@phosphor-icons/react/dist/csr/PlayCircle";
import { InfoIcon as Info } from "@phosphor-icons/react/dist/csr/Info";
import { LifebuoyIcon as LifeBuoy } from "@phosphor-icons/react/dist/csr/Lifebuoy";
import { LockIcon as Lock } from "@phosphor-icons/react/dist/csr/Lock";
import { EnvelopeIcon as Mail } from "@phosphor-icons/react/dist/csr/Envelope";
import { ChatTextIcon as MessageSquare } from "@phosphor-icons/react/dist/csr/ChatText";
import { RepeatIcon as Repeat } from "@phosphor-icons/react/dist/csr/Repeat";
import { ShieldIcon as Shield } from "@phosphor-icons/react/dist/csr/Shield";
import { SlidersHorizontalIcon as SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { DeviceMobileIcon as Smartphone } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import { UserIcon as User } from "@phosphor-icons/react/dist/csr/User";
import { UserMinusIcon as UserX } from "@phosphor-icons/react/dist/csr/UserMinus";
import { UsersIcon as Users } from "@phosphor-icons/react/dist/csr/Users";
import { WifiSlashIcon as WifiOff } from "@phosphor-icons/react/dist/csr/WifiSlash";
import type { Icon as IconType } from "@phosphor-icons/react";

/**
 * Les icônes du catalogue des réglages sont des noms Feather (ceux de l'app
 * mobile) ; le web dessine en Lucide. Cette table les fait correspondre — une
 * icône nouvelle dans le catalogue s'ajoute ici, le test le vérifie
 * (`webCoverage.test.ts`).
 */
export const CATALOG_ICONS: Readonly<Record<string, IconType>> = {
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
export function catalogIcon(name: string): IconType {
  return CATALOG_ICONS[name] ?? Info;
}
