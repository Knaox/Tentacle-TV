import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Delete } from "lucide-react";
import { FAMILY_PIN_LENGTH } from "@tentacle-tv/shared";
import { FamilyAvatar } from "../../family/FamilyAvatar";
import { pinKeyOf } from "./pinKeys";
import type { PinPadModel } from "./pickerTypes";

interface ProfilePinPadProps {
  pad: PinPadModel;
  onDigit: (digit: string) => void;
  onErase: () => void;
  /** Échap : retour aux profils. */
  onBack: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Le pavé du code PIN de « Qui regarde ? » — à l'ouverture comme depuis
 * « Changer de profil ». Quatre points, un pavé cliquable, et le CLAVIER : les
 * chiffres (rangée du haut comme pavé numérique), Retour arrière, Échap.
 * Rien n'est comparé ici : le quatrième chiffre part au serveur, qui seul dit
 * juste, faux (essais restants) ou bloqué. Le code ne vit que dans l'état du
 * pavé, jamais dans le stockage ni dans une adresse.
 *
 * Accessibilité : le groupe porte « Code PIN du profil … », la ligne d'état est une région
 * `polite` (« 2 chiffres sur 4 », le refus) ; chaque touche a son nom.
 * Un refus fait trembler les points (`animate-shake`, coupé par mouvement réduit).
 */
export const ProfilePinPad = memo(function ProfilePinPad({ pad, onDigit, onErase, onBack }: ProfilePinPadProps) {
  const { t } = useTranslation("profilePicker");
  const busy = pad.phase === "checking" || pad.phase === "locked";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = pinKeyOf(event.key);
      if (key === null) return;
      event.preventDefault();
      if (key === "back") onBack();
      else if (key === "erase") onErase();
      else onDigit(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onDigit, onErase]);

  const status =
    pad.message ??
    (pad.phase === "checking" ? t("pin.checking") : pad.typed > 0 ? t("pin.progress", { count: pad.typed }) : t("pin.prompt"));
  const statusTone = pad.phase === "wrong" || pad.phase === "locked" ? "text-status-error-fg" : "text-content-tertiary";

  return (
    <div role="group" aria-label={t("pin.title", { name: pad.profile.name })} className="flex flex-col items-center text-center">
      <FamilyAvatar
        userId={pad.profile.id}
        name={pad.profile.name}
        color={pad.profile.color}
        imageTag={pad.profile.imageTag}
        size={96}
      />
      {/* Le nom seul, en titre : « Code PIN de Inès » ne s'écrit pas, le pavé dit le reste. */}
      <h2 className="mt-5 max-w-full truncate text-2xl font-bold tracking-tight text-content-primary">
        {pad.profile.name}
      </h2>
      <p aria-live="polite" className={`mt-2 min-h-[1.25rem] text-sm ${statusTone}`}>{status}</p>

      <div
        aria-hidden
        key={pad.phase === "wrong" ? `wrong-${pad.message}` : "dots"}
        className={`mt-5 flex gap-4 ${pad.phase === "wrong" ? "animate-shake" : ""}`}
      >
        {Array.from({ length: FAMILY_PIN_LENGTH }, (_, index) => (
          // Le point vide, et le plein posé dessus en fondu d'opacité : rien ne se repeint.
          <span key={index} className="relative h-3.5 w-3.5 rounded-full border border-line-strong">
            <span
              className={`absolute -inset-px rounded-full bg-content-primary transition-opacity duration-150 ${index < pad.typed ? "opacity-100" : "opacity-0"}`}
            />
          </span>
        ))}
      </div>

      <div role="group" aria-label={t("pin.keypad")} className="mt-7 grid grid-cols-3 gap-3">
        {KEYS.map((digit) => (
          <PadKey key={digit} label={t("pin.digit", { digit })} disabled={busy} onPress={() => onDigit(digit)}>
            {digit}
          </PadKey>
        ))}
        <span aria-hidden />
        <PadKey label={t("pin.digit", { digit: "0" })} disabled={busy} onPress={() => onDigit("0")}>
          0
        </PadKey>
        <PadKey label={t("pin.erase")} disabled={busy || pad.typed === 0} onPress={onErase}>
          <Delete size={20} aria-hidden />
        </PadKey>
      </div>
    </div>
  );
});

function PadKey({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      // Le clic ne vole pas le focus : le clavier continue de taper au même endroit.
      onMouseDown={(event) => event.preventDefault()}
      className="flex h-14 w-14 items-center justify-center rounded-full border border-line-subtle bg-fill-soft text-xl font-semibold text-content-primary transition-transform duration-150 hover:bg-fill-medium active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
