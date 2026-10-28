/**
 * Octave — l'interface des gestes sur un titre, côté web (`OctaveActionsUi` d'api-client) : les mots de l'espace
 * `music`, le toast de l'application, le stockage de l'appareil (`localStorage`).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { OctaveActionsUi } from "@tentacle-tv/api-client";
import { useToast } from "../../../contexts/ToastContext";

const store = typeof localStorage === "undefined" ? null : localStorage;

export function useOctaveActionsUi(): OctaveActionsUi {
  const { t } = useTranslation("music");
  const toast = useToast();
  return useMemo(() => ({ t: t as OctaveActionsUi["t"], notify: toast.show, store }), [t, toast.show]);
}
