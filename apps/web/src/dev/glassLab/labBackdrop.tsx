/**
 * Labo du verre — les DESSOUS : ce que le verre doit réfracter et sur quoi il
 * doit rester lisible. Du détail fin, partout : un verre ne se juge pas sur un
 * dégradé lisse (rien à courber), ni sur un seul fond.
 *
 *  - `affiches` : les vraies affiches et images de fond de la bibliothèque
 *    connectée (au hasard), sinon les illustrations ;
 *  - `illustrations` : la troupe riso embarquée (`public/avatars/`, détaillée) ;
 *  - `texte` : une typographie dense, noir sur blanc et blanc sur noir ;
 *  - `mire` : barres de couleur, lignes fines, damier ;
 *  - `brun` : un brun-rouge MOYEN et détaillé (trame, typographie) — le cas
 *    où un verre clair vire au gris ;
 *  - `blanc`, `noir` : les extrêmes, avec une trame fine ;
 *  - `mixte` : la bande CLAIRE d'une page en thème clair, puis un héros
 *    sombre — le dessous qu'un menu ou une feuille chevauche (ton par bande).
 *
 * Styles en ligne seulement : le labo n'existe que dans les paquets de
 * développement, et aucune de ses classes ne doit entrer dans la feuille du
 * client LG.
 */

import { memo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { AVATAR_CHARACTERS } from "@tentacle-tv/shared";

import { avatarImageUrl } from "../../profiles/avatarGallery/avatarImages";

export type LabBackdrop = "affiches" | "illustrations" | "texte" | "mire" | "brun" | "blanc" | "noir" | "mixte";

export const LAB_BACKDROPS: readonly LabBackdrop[] = ["affiches", "illustrations", "texte", "mire", "brun", "blanc", "noir", "mixte"];

/** `mixte` : hauteur de la bande claire — elle coupe le menu du labo en deux. */
export const MIXED_LIGHT_BAND = 200;

interface LabItem {
  Id: string;
  ImageTags?: { Primary?: string };
  BackdropImageTags?: string[];
}

/** Des affiches et des fonds de la vraie bibliothèque, au hasard. */
function useLibraryImages(): { posters: string[]; backdrops: string[] } {
  const client = useJellyfinClient();
  const userId = useUserId();
  const { data } = useQuery({
    queryKey: ["dev-glass-lab", userId],
    enabled: userId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: () =>
      client
        .fetch<{ Items: LabItem[] }>(
          `/Users/${userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&SortBy=Random&Limit=48` +
            `&Fields=BackdropImageTags&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`,
        )
        .then((r) => r.Items),
  });
  const items = data ?? [];
  return {
    posters: items
      .filter((i) => i.ImageTags?.Primary)
      .map((i) => client.getImageUrl(i.Id, "Primary", { height: 540, tag: i.ImageTags?.Primary })),
    backdrops: items
      .filter((i) => i.BackdropImageTags?.[0])
      .map((i) => client.getImageUrl(i.Id, "Backdrop", { width: 1920, tag: i.BackdropImageTags?.[0] })),
  };
}

const ILLUSTRATIONS = AVATAR_CHARACTERS.map((c) => avatarImageUrl(c.id));

const cover: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

function Mosaic({ images, height }: { images: string[]; height: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", padding: 0, margin: 0 }}>
      {images.map((src, i) => (
        <div key={`${src}-${i}`} style={{ width: height * (2 / 3), height, overflow: "hidden" }}>
          <img src={src} alt="" style={cover} draggable={false} />
        </div>
      ))}
    </div>
  );
}

const PROSE =
  "Le Liquid Glass ne cache pas ce qu'il recouvre : il le courbe au bord, le laisse net au centre, " +
  "et garde le texte lisible par l'ombre de ses glyphes. Une lentille, pas un voile. ";

function TextBackdrop() {
  const block = (dark: boolean, size: number, key: number) => (
    <div
      key={key}
      style={{
        background: dark ? "#050505" : "#fbfbf8",
        color: dark ? "#f5f5f5" : "#111",
        padding: "28px 40px",
        fontSize: size,
        lineHeight: 1.25,
        fontWeight: size > 40 ? 800 : 400,
        letterSpacing: size > 40 ? "-0.02em" : "normal",
      }}
    >
      {size > 40 ? "LA NUIT DES VERRES — UN FILM DE TENTACLE" : PROSE.repeat(6)}
    </div>
  );
  return <div>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => block(i % 2 === 1, i % 4 === 0 ? 72 : 17, i))}</div>;
}

function TestCard() {
  const bars = ["#e8e8e8", "#f2d22b", "#2bd9e6", "#2be65a", "#e62bd5", "#e6302b", "#2b46e6", "#111"];
  return (
    <div>
      <div style={{ display: "flex", height: 520 }}>
        {bars.map((c) => (
          <div key={c} style={{ flex: 1, background: c }} />
        ))}
      </div>
      <div
        style={{
          height: 520,
          backgroundImage:
            "repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 6px), repeating-linear-gradient(0deg, transparent 0 40px, rgba(255,0,80,0.5) 40px 42px)",
        }}
      />
      <div
        style={{
          height: 900,
          backgroundColor: "#fff",
          backgroundImage: "conic-gradient(#111 25%, #fff 0 50%, #111 0 75%, #fff 0)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

/** Des affiches brun-rouge de luminance MOYENNE, trame et texte compris. */
function BrownBackdrop() {
  const tones = ["#8a3b2a", "#7a2f24", "#9b4a32", "#6e2a22", "#a0522d", "#843a2c"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", background: "#3a1712" }}>
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 213,
            height: 320,
            background: tones[i % tones.length],
            backgroundImage:
              "radial-gradient(rgba(255,214,170,0.35) 1.2px, transparent 1.6px), linear-gradient(160deg, rgba(255,190,140,0.25), rgba(0,0,0,0.35))",
            backgroundSize: "7px 7px, 100% 100%",
            color: "rgba(255,226,200,0.9)",
            padding: 18,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.05,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
          }}
        >
          {["ROUILLE", "TERRE BRÛLÉE", "LE DÉSERT", "BRIQUE", "CUIVRE"][i % 5]}
        </div>
      ))}
    </div>
  );
}

function SolidBackdrop({ dark }: { dark: boolean }) {
  const line = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";
  return (
    <div
      style={{
        minHeight: 2400,
        background: dark ? "#000" : "#fff",
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
        color: dark ? "#fff" : "#000",
        fontSize: 15,
        padding: 40,
      }}
    >
      {PROSE.repeat(20)}
    </div>
  );
}

/** Une page claire (titre, texte dense) au-dessus d'un héros sombre. */
function MixedBackdrop({ hero, posters }: { hero: string | undefined; posters: string[] }) {
  return (
    <div style={{ background: "#000" }}>
      <div style={{ height: MIXED_LIGHT_BAND, overflow: "hidden", background: "#f2f2f5", color: "#1c1c1e", padding: "56px 40px 0" }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Pour vous</div>
        <div style={{ fontSize: 14, lineHeight: 1.35, color: "#3a3a3c" }}>{PROSE.repeat(4)}</div>
      </div>
      <div style={{ height: 640, overflow: "hidden", filter: "brightness(0.55)" }}>
        {hero ? <img src={hero} alt="" style={cover} draggable={false} /> : <Mosaic images={posters.slice(0, 7)} height={640} />}
      </div>
      <Mosaic images={[...posters, ...posters]} height={300} />
    </div>
  );
}

/** Le dessous choisi, sur toute la hauteur défilable du labo. */
export const LabBackdropView = memo(function LabBackdropView({ kind }: { kind: LabBackdrop }) {
  const library = useLibraryImages();
  if (kind === "texte") return <TextBackdrop />;
  if (kind === "mire") return <TestCard />;
  if (kind === "brun") return <BrownBackdrop />;
  if (kind === "blanc" || kind === "noir") return <SolidBackdrop dark={kind === "noir"} />;

  const posters = (kind === "affiches" || kind === "mixte") && library.posters.length > 0 ? library.posters : ILLUSTRATIONS;
  const hero = kind === "affiches" || kind === "mixte" ? library.backdrops[0] : undefined;
  if (kind === "mixte") return <MixedBackdrop hero={hero} posters={posters} />;
  return (
    <div style={{ background: "#000" }}>
      <div style={{ height: 640, overflow: "hidden" }}>
        {hero ? <img src={hero} alt="" style={cover} draggable={false} /> : <Mosaic images={posters.slice(0, 7)} height={640} />}
      </div>
      <Mosaic images={[...posters, ...posters]} height={300} />
    </div>
  );
});
