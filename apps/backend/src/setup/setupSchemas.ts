import { z } from "zod";
import { isValidJellyfinUsername } from "./jellyfin/startup";

/**
 * Les corps acceptés par l'assistant — stricts : un champ inconnu est un
 * refus (`invalid_input`), pas un champ ignoré. Les bornes tiennent les
 * valeurs dans ce que Jellyfin et MariaDB acceptent.
 */
const url = z.string().trim().min(1).max(2048);
/** Un compte EXISTANT : le serveur ne juge pas son mot de passe, Jellyfin le fait. */
const anyUsername = z.string().trim().min(1).max(256);
const anyPassword = z.string().min(1).max(256);
/** Un compte CRÉÉ ici : un nom que Jellyfin accepte, un mot de passe d'au moins 8 caractères. */
const newUsername = z.string().trim().min(1).max(64).refine(isValidJellyfinUsername);
const newPassword = z.string().min(8).max(256);

const uiCulture = z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/);
const metadataCountry = z.string().regex(/^[A-Z]{2}$/);
const metadataLanguage = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/);

export const sessionSchema = z.object({ token: z.string().max(64) }).strict();

export const databaseSchema = z
  .object({
    host: z.string().trim().min(1).max(253).regex(/^[A-Za-z0-9._:[\]-]+$/),
    port: z.number().int().min(1).max(65535),
    database: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_$-]+$/),
    user: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(256),
  })
  .strict();

export const probeSchema = z.object({ url }).strict();

export const initializeSchema = z
  .object({
    url,
    username: newUsername,
    password: newPassword,
    serverName: z.string().trim().min(1).max(64).optional(),
    uiCulture,
    metadataCountry,
    metadataLanguage,
  })
  .strict();

export const connectSchema = z.union([
  z.object({ url, username: anyUsername, password: anyPassword }).strict(),
  // Une clé Jellyfin : 32 caractères hexadécimaux ; la borne laisse de la marge.
  z.object({ url, apiKey: z.string().trim().regex(/^[A-Za-z0-9]{16,128}$/) }).strict(),
]);

export const browseSchema = z.object({ path: z.string().min(1).max(4096).optional() }).strict();

/** Le nom devient un dossier chez Jellyfin : ni séparateur, ni caractère interdit sous Windows, ni blanc au bord. */
const libraryName = z.string().max(64).regex(/^[^\s/\\:*?"<>|](?:[^/\\:*?"<>|]*[^\s/\\:*?"<>|])?$/);

export const librariesSchema = z
  .object({
    libraries: z
      .array(
        z
          .object({
            name: libraryName,
            type: z.enum(["movies", "tvshows", "mixed"]),
            paths: z.array(z.string().min(1).max(4096)).min(1).max(10),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    metadataLanguage,
    metadataCountry,
  })
  .strict();

export const completeSchema = z
  .object({
    username: anyUsername,
    password: anyPassword,
    // Comme `/api/auth/login` : le format est contraint, la valeur finit dans un en-tête.
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
    client: z.string().max(64).optional(),
    device: z.string().max(64).optional(),
  })
  .strict();
