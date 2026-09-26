import { useEffect, useState } from "react";

/** code pays → adresse `data:` du drapeau SVG (3:2). */
export type CountryFlags = Readonly<Record<string, string>>;

let pending: Promise<CountryFlags> | null = null;
let loaded: CountryFlags | null = null;

/**
 * Les drapeaux, chargés une fois et À PART : ~45 Ko compressés que seule la
 * page Métadonnées demande, dans leur propre morceau. En SVG et non en émoji :
 * Windows ne dessine pas les drapeaux-émojis (deux lettres à la place — la
 * raison du passage d'AudioFlag à `country-flag-icons`). Un échec de
 * chargement se retente au prochain appel.
 */
export function loadCountryFlags(): Promise<CountryFlags> {
  if (!pending) {
    pending = import("country-flag-icons/string/3x2")
      .then((mod) => {
        const flags: Record<string, string> = {};
        for (const [code, svg] of Object.entries(mod)) {
          if (/^[A-Z]{2}$/.test(code) && typeof svg === "string") {
            flags[code] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
          }
        }
        loaded = flags;
        return flags;
      })
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** Les drapeaux une fois chargés ; `null` d'ici là — l'appelant dessine une case neutre. */
export function useCountryFlags(): CountryFlags | null {
  const [flags, setFlags] = useState<CountryFlags | null>(loaded);
  useEffect(() => {
    if (flags) return;
    let alive = true;
    loadCountryFlags().then(
      (f) => {
        if (alive) setFlags(f);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [flags]);
  return flags;
}
