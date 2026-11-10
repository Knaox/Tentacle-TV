/**
 * « Qui regarde ? » dans le labo : la VRAIE vue (`WhoIsWatchingView`), sur un modèle factice —
 * le contrôleur (`ProfileLaunchScreen`) recharge la page au nom du profil choisi, ce qu'un labo
 * ne doit pas faire. `?pin=1` ouvre le pavé du code.
 */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { PickerProfile, WhoIsWatchingModel } from "../../profiles/picker/pickerTypes";
import { WhoIsWatchingView } from "../../profiles/picker/WhoIsWatchingView";

const profile = (id: string, name: string, color: PickerProfile["color"], more: Partial<PickerProfile> = {}): PickerProfile => ({
  id, name, color, imageTag: null, hasPin: false, pinLock: false, current: false, guest: false, own: false, lockedLabel: null, ...more,
});

const PROFILES: readonly PickerProfile[] = [
  profile("u-camille", "Camille", "violet", { own: true, hasPin: true, pinLock: true }),
  profile("u-noe", "Noé", "blue", { hasPin: true, pinLock: true }),
  profile("u-lea", "Léa", "pink"),
  profile("g-salon", "Salon", "teal", { guest: true }),
  profile("g-mamie", "Mamie", "amber", { guest: true, hasPin: true, pinLock: true, lockedLabel: "Bloqué jusqu'à 22:15" }),
];

export function LabWhoIsWatching() {
  const [params] = useSearchParams();
  const [stay, setStay] = useState(false);
  const [typed, setTyped] = useState(2);
  const model: WhoIsWatchingModel = params.get("pin")
    ? { kind: "pin", pad: { profile: PROFILES[1], typed, phase: "typing", message: null } }
    : { kind: "picker", profiles: PROFILES, canManage: true, notice: null, entering: null, stay };

  return (
    <WhoIsWatchingView
      model={model}
      onPick={() => undefined}
      onManage={() => undefined}
      onRetry={() => undefined}
      onDigit={() => setTyped((n) => Math.min(4, n + 1))}
      onErase={() => setTyped((n) => Math.max(0, n - 1))}
      onBack={() => undefined}
      onToggleStay={() => setStay((value) => !value)}
    />
  );
}
