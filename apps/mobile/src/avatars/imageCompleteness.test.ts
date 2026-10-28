import { describe, expect, it } from "vitest";
import { imageBytesComplete } from "./imageCompleteness";

const png = (body: number[], end = true) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...body, ...(end ? [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82] : [])]);

describe("une image du cache disque est-elle entière ?", () => {
  it("PNG : entier avec son IEND, tronqué sans (la photo rognée du banc mo2)", () => {
    expect(imageBytesComplete(png([1, 2, 3]))).toBe(true);
    expect(imageBytesComplete(png([1, 2, 3], false))).toBe(false);
  });

  it("JPEG : EOI à la fin, octets nuls de remplissage tolérés", () => {
    expect(imageBytesComplete(new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]))).toBe(true);
    expect(imageBytesComplete(new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9, 0, 0]))).toBe(true);
    expect(imageBytesComplete(new Uint8Array([0xff, 0xd8, 1, 2, 3]))).toBe(false);
  });

  it("WebP : la taille RIFF annoncée doit être là", () => {
    const head = [0x52, 0x49, 0x46, 0x46, 8, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    expect(imageBytesComplete(new Uint8Array([...head, 1, 2, 3, 4]))).toBe(true);
    expect(imageBytesComplete(new Uint8Array([...head, 1]))).toBe(false);
  });

  it("GIF : le terminateur ; format inconnu : tenu pour entier ; vide : non", () => {
    expect(imageBytesComplete(new Uint8Array([0x47, 0x49, 0x46, 0x38, 1, 0x3b]))).toBe(true);
    expect(imageBytesComplete(new Uint8Array([0x47, 0x49, 0x46, 0x38, 1]))).toBe(false);
    expect(imageBytesComplete(new Uint8Array([1, 2, 3]))).toBe(true);
    expect(imageBytesComplete(new Uint8Array([]))).toBe(false);
  });
});
