// La licence du lecteur de l'Apple TV : PrismCore tire FFmpeg de MPVKit, qui
// publie DEUX produits — `MPVKit` (LGPL) et `MPVKit-GPL` (mpv GPL,
// libsmbclient). L'App Store ne tolère pas le second (TestFlight non plus :
// c'est le même binaire). Vérifié le 2026-10-07 sur le build Release : aucun
// GPL ; cette règle empêche qu'il en entre. Zéro dépendance npm.

/** Les versions de MPVKit dont le produit `MPVKit` a été vérifié LGPL dans le binaire. */
export const VERIFIED_MPVKIT = new Set(['1.0.0']);

/** Le produit MPVKit que PrismCore réclame, lu dans son Package.swift. */
export function mpvkitProducts(packageSwift) {
  return [...packageSwift.matchAll(/\.product\(\s*name:\s*"([^"]+)"\s*,\s*package:\s*"MPVKit"\s*\)/g)].map((m) => m[1]);
}

/** L'épinglage de MPVKit dans Package.resolved (format v2 ou v3). */
export function mpvkitPin(resolvedJson) {
  const pins = JSON.parse(resolvedJson).pins ?? [];
  const pin = pins.find((p) => (p.identity ?? '').toLowerCase() === 'mpvkit');
  return pin ? { version: pin.state?.version ?? null, revision: pin.state?.revision ?? null } : null;
}

/** Verdict : `ok` vrai si l'Apple TV peut partir vers TestFlight ou l'App Store. */
export function tvosPlayerVerdict(packageSwift, resolvedJson) {
  const reasons = [];
  const products = mpvkitProducts(packageSwift);
  if (products.length === 0) reasons.push('PrismCore ne réclame aucun produit MPVKit lisible');
  for (const name of products) {
    if (name !== 'MPVKit') reasons.push(`produit ${name} : seul « MPVKit » (LGPL) est admis`);
  }
  const pin = mpvkitPin(resolvedJson);
  if (!pin) reasons.push('MPVKit absent de Package.resolved : version non épinglée');
  else if (!VERIFIED_MPVKIT.has(pin.version)) {
    reasons.push(`MPVKit ${pin.version ?? '(sans version)'} : licence du binaire non vérifiée (VERIFIED_MPVKIT)`);
  }
  return { ok: reasons.length === 0, products, pin, reasons };
}
