/**
 * Le calcul d'un IID d'interface générique.
 *
 * Un GUID faux ne se signale pas : `QueryInterface` refuse, et la mise à jour
 * « n'est simplement pas disponible ». Ce test l'ancre sur une valeur connue de
 * tous — `IIterable<HSTRING>`, publiée et reproductible — plutôt que sur le
 * résultat de notre propre code.
 */

import { describe, expect, it } from "vitest";
import { guidBuffer, IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE, parameterizedIid } from "./guid";

/** Rend un tampon de 16 octets sous la forme `{XXXXXXXX-XXXX-...}`. */
function text(bytes: Buffer): string {
  const h = (n: number): string => n.toString(16).padStart(2, "0").toUpperCase();
  const o = (i: number): number => bytes[i] ?? 0;
  const queue = [...bytes.subarray(10)].map(h).join("");
  return (
    `{${h(o(3))}${h(o(2))}${h(o(1))}${h(o(0))}-${h(o(5))}${h(o(4))}-` +
    `${h(o(7))}${h(o(6))}-${h(o(8))}${h(o(9))}-${queue}}`
  );
}

describe("GUID constants", () => {
  it("les trois premiers champs partent en petit-boutiste", () => {
    // Le piège classique : un GUID n'est pas une suite d'octets, ce sont trois
    // entiers puis huit octets bruts.
    const bytes = guidBuffer("00000035-0000-0000-C000-000000000046");
    expect([...bytes]).toEqual([0x35, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46]);
  });

  it("refuse ce qui n'est pas un GUID", () => {
    expect(() => guidBuffer("pas-un-guid")).toThrow();
  });
});

describe("IID d'interface generique", () => {
  it("reproduit l'IID publie de IIterable<HSTRING>", () => {
    // Valeur de reference, independante de ce depot : c'est elle qui prouve la
    // graine, l'ordre des octets et les bits de version.
    const iid = parameterizedIid("pinterface({faa585ea-6214-4217-afda-7f46de5869b3};string)");
    expect(text(iid)).toBe("{E2FCC7C1-3BFC-5A0B-B2B0-72E769D1CB7E}");
  });

  it("pose la version 5 et la variante RFC 4122", () => {
    const iid = parameterizedIid(IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE);
    // Data3 est en petit-boutiste : l'octet de version est le SECOND.
    expect((iid[7] ?? 0) & 0xf0).toBe(0x50);
    expect((iid[8] ?? 0) & 0xc0).toBe(0x80);
  });

  it("rend IIterable<StorePackageUpdate>, l'interface attendue par le Store", () => {
    // Derivee par le meme algorithme que le SDK (`generate_guid`, base.h), et
    // verifiee a l'execution par le `QueryInterface` de `msixUpdate.ts` : s'il
    // refusait, l'application ouvrirait la page du Store a la place.
    expect(text(parameterizedIid(IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE))).toBe(
      "{6B076C51-849E-5EC5-AED5-9B0585591902}",
    );
  });

  it("une signature differente donne un identifiant different", () => {
    const a = parameterizedIid("pinterface({faa585ea-6214-4217-afda-7f46de5869b3};string)");
    const b = parameterizedIid(IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE);
    expect(text(a)).not.toBe(text(b));
  });
});
