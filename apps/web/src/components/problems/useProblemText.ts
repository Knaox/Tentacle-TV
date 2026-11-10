import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WarningIcon as AlertTriangle } from "@phosphor-icons/react/dist/csr/Warning";
import { PulseIcon as Activity } from "@phosphor-icons/react/dist/csr/Pulse";
import { BellIcon as Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { SubtitlesIcon as Captions } from "@phosphor-icons/react/dist/csr/Subtitles";
import { ScreencastIcon as Cast } from "@phosphor-icons/react/dist/csr/Screencast";
import { ClockIcon as Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { FileIcon as File } from "@phosphor-icons/react/dist/csr/File";
import { FilmStripIcon as Film } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { HardDriveIcon as HardDrive } from "@phosphor-icons/react/dist/csr/HardDrive";
import { InfoIcon as Info } from "@phosphor-icons/react/dist/csr/Info";
import { LockIcon as Lock } from "@phosphor-icons/react/dist/csr/Lock";
import { PackageIcon as Package } from "@phosphor-icons/react/dist/csr/Package";
import { HardDrivesIcon as Server } from "@phosphor-icons/react/dist/csr/HardDrives";
import { ShieldIcon as Shield } from "@phosphor-icons/react/dist/csr/Shield";
import { UserIcon as User } from "@phosphor-icons/react/dist/csr/User";
import { UsersIcon as Users } from "@phosphor-icons/react/dist/csr/Users";
import { WifiSlashIcon as WifiOff } from "@phosphor-icons/react/dist/csr/WifiSlash";
import type { Icon as IconType } from "@phosphor-icons/react";
import {
  detailText, problemCopyText,
  type ProblemActionKey, type ProblemIcon, type ProblemModel,
} from "@tentacle-tv/shared";

/** Le vocabulaire d'icônes du modèle, dessiné par Lucide (le jeu du web). */
export const PROBLEM_ICONS: Record<ProblemIcon, IconType> = {
  wifiOff: WifiOff,
  server: Server,
  shield: Shield,
  lock: Lock,
  user: User,
  file: File,
  film: Film,
  subtitles: Captions,
  gauge: Activity,
  clock: Clock,
  users: Users,
  puzzle: Package,
  alert: AlertTriangle,
  bell: Bell,
  cast: Cast,
  storage: HardDrive,
  info: Info,
};

export interface ProblemText {
  title: string;
  reason: string;
  hint: string | null;
  actions: { key: ProblemActionKey; label: string }[];
  details: string[];
  /** Ce que « Copier » met dans le presse-papiers. */
  copy: string;
  /** « Code : playbackStart/transcodeFailed » — en petit, pour le support (le mobile le montre). */
  code: string;
}

/** Le modèle, mis en mots dans la langue de l'interface — même lecture que le mobile. */
export function useProblemText(model: ProblemModel): ProblemText {
  const { t } = useTranslation("errors");
  return useMemo(() => {
    const tr = (key: string, values?: Record<string, string | number>) => t(key, values);
    return {
      title: tr(model.titleKey),
      reason: tr(model.reasonKey, model.values),
      hint: model.hintKey ? tr(model.hintKey, model.values) : null,
      actions: model.actions.map((action) => ({ key: action.key, label: tr(action.labelKey) })),
      details: model.details.map((detail) => detailText(detail, tr)),
      copy: problemCopyText(model, tr),
      code: tr("supportCode", { code: model.code }),
    };
  }, [model, t]);
}
