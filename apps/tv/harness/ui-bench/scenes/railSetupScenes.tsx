import { useCallback, useState } from "react";
import {
  RAIL_SETUP_APPLY_CONFIRM_KEY,
  RAIL_SETUP_APPLY_DECLINE_KEY,
  RAIL_SETUP_CONTINUE_KEY,
  RAIL_SETUP_SKIP_KEY,
  railSetupApplyTileKey,
  railSetupMoveKey,
  railSetupRowKey,
  toggleRailSetupTarget,
} from "@tentacle-tv/tv-core";
import { RailSetupView, type RailSetupModel } from "../../../src/redesign/screens/railSetup/RailSetupView";
import type { BenchData } from "../data/benchData";
import { benchLibraries } from "../data/navModels";
import { benchRailSetup, benchRailSetupTargets, type BenchRailSetupOptions } from "../data/railSetupModels";
import type { BenchScene } from "./types";

/**
 * La préconfiguration de la barre (« Quelles bibliothèques dans votre
 * barre ? ») : la liste du compte Knaoxtest, une bibliothèque retirée, une
 * famille bien garnie (la liste défile, l'aperçu suit), un déplacement en
 * cours, puis l'étape du propriétaire — après « Continuer », et depuis
 * Réglages › Navigation sans profil coché. La scène « vivante » répond à OK :
 * épingler, cocher.
 */

const MANY = 14;
const lib = (data: BenchData, n: number, count?: number) => benchLibraries(data, count)[n]?.key ?? "";

function LiveLibraries({ data, options }: { data: BenchData; options: BenchRailSetupOptions }) {
  const [unpinned, setUnpinned] = useState<string[]>(options.unpinned ?? []);
  const onTogglePin = useCallback(
    (key: string) => setUnpinned((current) => (current.includes(key) ? current.filter((other) => other !== key) : [...current, key])),
    [],
  );
  return <RailSetupView model={benchRailSetup(data, { ...options, unpinned })} onTogglePin={onTogglePin} />;
}

function LiveApply({ origin, selected: initial }: { origin: "setup" | "settings"; selected: string[] }) {
  const [selected, setSelected] = useState(initial);
  const targets = benchRailSetupTargets(selected);
  const onToggleTarget = useCallback(
    (userId: string) => setSelected((current) => toggleRailSetupTarget(current, userId, targets.map((target) => target.userId))),
    [targets],
  );
  const model: RailSetupModel = { kind: "apply", origin, targets, busy: false };
  return <RailSetupView model={model} onToggleTarget={onToggleTarget} />;
}

const LIST_KEYS = (rows: number) => [
  railSetupRowKey(0),
  railSetupMoveKey(0),
  ...(rows > 1 ? [railSetupRowKey(rows - 1)] : []),
  RAIL_SETUP_CONTINUE_KEY,
  RAIL_SETUP_SKIP_KEY,
];

const APPLY_KEYS = [railSetupApplyTileKey(0), railSetupApplyTileKey(1), RAIL_SETUP_APPLY_CONFIRM_KEY, RAIL_SETUP_APPLY_DECLINE_KEY];

export const RAIL_SETUP_SCENES: BenchScene[] = [
  {
    id: "preconfig/bibliotheques",
    group: "Préconfiguration",
    label: "Les bibliothèques du compte, toutes épinglées",
    focusKeys: LIST_KEYS(3),
    render: (data) => <LiveLibraries data={data} options={{}} />,
  },
  {
    id: "preconfig/retiree",
    group: "Préconfiguration",
    label: "Une bibliothèque retirée de la barre",
    focusKeys: [railSetupRowKey(1), railSetupMoveKey(1)],
    render: (data) => <LiveLibraries data={data} options={{ unpinned: [lib(data, 1)] }} />,
  },
  {
    id: "preconfig/famille",
    group: "Préconfiguration",
    label: "Profil d'une famille, 14 bibliothèques (la liste défile)",
    focusKeys: [railSetupRowKey(0), railSetupRowKey(MANY - 1), railSetupMoveKey(MANY - 1), RAIL_SETUP_CONTINUE_KEY],
    render: (data) => (
      <LiveLibraries data={data} options={{ libraries: MANY, profileName: "Léa", unpinned: [lib(data, 4, MANY), lib(data, 7, MANY)] }} />
    ),
  },
  {
    id: "preconfig/deplacement",
    group: "Préconfiguration",
    label: "Une bibliothèque en cours de déplacement",
    focusKeys: [railSetupMoveKey(1)],
    render: (data) => {
      const libs = benchLibraries(data).map((entry) => entry.key);
      const order = [libs[1], libs[0], ...libs.slice(2)];
      return <RailSetupView model={benchRailSetup(data, { order, movingKey: libs[0] })} />;
    },
  },
  {
    id: "preconfig/proprietaire",
    group: "Préconfiguration",
    label: "Le propriétaire : appliquer à d'autres profils (Léa cochée)",
    focusKeys: APPLY_KEYS,
    render: () => <LiveApply origin="setup" selected={["lea"]} />,
  },
  {
    id: "preconfig/proprietaire-reglages",
    group: "Préconfiguration",
    label: "Depuis Réglages › Navigation, aucun profil coché",
    focusKeys: [railSetupApplyTileKey(0), RAIL_SETUP_APPLY_DECLINE_KEY],
    render: () => <LiveApply origin="settings" selected={[]} />,
  },
  {
    id: "preconfig/attente",
    group: "Préconfiguration",
    label: "L'attente du socle (rien à lire)",
    render: () => <RailSetupView model={{ kind: "waiting" }} />,
  },
];
