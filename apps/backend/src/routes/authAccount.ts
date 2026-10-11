import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { requireAuth } from "../middleware/auth";
import { revokePairedDevices } from "../services/deviceRevocation";
import { forgetFamilyAccount } from "../services/family/familyMembers";
import { isFamilyGuest } from "../services/family/familyGuestMarkers";
import { clearSessionCookie } from "./authCookie";
import { jellyfinAuthHeaders } from "../services/jellyfinAuth";
import { createJellyfinAccount, type AccountCreationRefusal } from "../services/accountRegistration";

/** Cycle de vie du compte : création par invitation, suppression, demande de
 *  réinitialisation. Séparé de `auth.ts`, qui ne garde que la session. */

/**
 * La clé d'invitation est générée en hexadécimal MINUSCULE ; saisie à la main
 * (le miroir mobile la tape en majuscules), elle arrive dans n'importe quelle
 * casse. MariaDB l'ignorait (`utf8mb4_unicode_ci`), SQLite non : on la
 * ramène à sa forme à l'entrée (docs/sqlite/DECISION.md § 9). Le nom perd ses
 * espaces de bord (souvent posés par un clavier de téléphone) : Jellyfin le
 * refuserait pour eux seuls.
 */
export const registerSchema = z.object({
  inviteKey: z.string().trim().min(1).toLowerCase(),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6),
});

const resetRequestSchema = z.object({ username: z.string().min(1) });

/**
 * Les refus de l'inscription, nommés : `code` dit lequel, `message` reste — les
 * clients livrés l'affichent tel quel. La page d'invitation du serveur
 * (`static/invitePage.ts`, interface web coupée) les dit dans la langue du
 * navigateur. Les codes traversent le réseau : ils ne se renomment pas.
 */
export type RegisterRefusalCode =
  | "invite_invalid"
  | "invite_exhausted"
  | "invite_expired"
  | "jellyfin_unconfigured"
  | AccountCreationRefusal;

/** La règle de Jellyfin pour un nom (`services/accountRegistration.ts`), dite aux clients livrés. */
const USERNAME_RULE = "Ce nom d'utilisateur n'est pas accepté : lettres, chiffres, espaces et . - _ ' @ + seulement";

function refuse(reply: FastifyReply, status: number, code: RegisterRefusalCode, message: string) {
  return reply.status(status).send({ message, code });
}

export const authAccountRoutes: FastifyPluginAsync = async (app) => {
  /** POST /api/auth/register — Create a Jellyfin user with an invite key. */
  app.post("/register", { config: { rateLimit: { max: 3, timeWindow: 60000 } } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const prisma = getPrisma();
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();

    if (!jellyfinUrl || !apiKey) {
      return refuse(reply, 503, "jellyfin_unconfigured", "Jellyfin non configuré");
    }

    // 1. Validate invite key
    const invite = await prisma.inviteKey.findUnique({
      where: { key: body.inviteKey },
    });

    if (!invite) {
      return refuse(reply, 400, "invite_invalid", "Clé d'invitation invalide");
    }
    if (invite.currentUses >= invite.maxUses) {
      return refuse(reply, 400, "invite_exhausted", "Clé d'invitation épuisée");
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return refuse(reply, 400, "invite_expired", "Clé d'invitation expirée");
    }

    // 2. Create user on Jellyfin — un nom pris ou refusé est un refus à corriger, pas une panne
    // du serveur (le mobile n'en disait qu'« erreur du serveur »).
    const created = await createJellyfinAccount(jellyfinUrl, apiKey, body.username, body.password);
    if (!created.ok) {
      if (created.refusal === "username_taken") return refuse(reply, 409, "username_taken", "Ce nom d'utilisateur est déjà pris");
      if (created.refusal === "username_invalid") return refuse(reply, 400, "username_invalid", USERNAME_RULE);
      return refuse(reply, 500, "account_creation_failed", created.detail || "Échec de création du compte");
    }
    const jellyfinUser = created.user;

    // 3. Mark invite key as used
    await prisma.$transaction([
      prisma.inviteKey.update({
        where: { id: invite.id },
        data: { currentUses: { increment: 1 } },
      }),
      prisma.inviteUsage.create({
        data: {
          inviteKeyId: invite.id,
          jellyfinUserId: jellyfinUser.Id,
          username: body.username,
        },
      }),
    ]);

    return reply.status(201).send({
      message: "Compte créé avec succès",
      userId: jellyfinUser.Id,
    });
  });

  /** DELETE /api/auth/account — Delete user account (Jellyfin + Tentacle DB). */
  app.delete("/account", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as { userId: string; username: string; isAdmin: boolean };

    // Prevent admin self-deletion
    if (user.isAdmin) {
      return reply.status(403).send({
        message: "Les administrateurs ne peuvent pas supprimer leur propre compte",
      });
    }

    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();

    if (!jellyfinUrl || !apiKey) {
      return reply.status(503).send({ message: "Jellyfin non configuré" });
    }

    // 1. Delete user from Jellyfin
    try {
      const res = await fetch(`${jellyfinUrl}/Users/${user.userId}`, {
        method: "DELETE",
        headers: jellyfinAuthHeaders(apiKey),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Jellyfin responded with ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de suppression Jellyfin";
      return reply.status(500).send({ message: msg });
    }

    // 2. Clean up Tentacle DB data — ses TV d'abord, par la révocation commune :
    // prévenues en direct, refusées partout, leurs sessions fermées. Puis la
    // Famille : sa famille dissoute (invités supprimés), ses adhésions retirées.
    const prisma = getPrisma();
    try {
      const devices = await prisma.pairedDevice.findMany({ where: { jellyfinUserId: user.userId, parentId: null }, select: { id: true } });
      await revokePairedDevices(devices, "account");
      await forgetFamilyAccount(user.userId, Date.now()).catch((err) => {
        request.log.warn({ err: (err as Error)?.message }, "famille du compte supprimé : reprise au prochain balayage");
      });
      await prisma.$transaction([
        prisma.libraryPreference.deleteMany({ where: { jellyfinUserId: user.userId } }),
        prisma.notification.deleteMany({ where: { jellyfinUserId: user.userId } }),
        prisma.inviteUsage.deleteMany({ where: { jellyfinUserId: user.userId } }),
      ]);
      // Delete ticket messages then tickets (cascade handles messages)
      const tickets = await prisma.supportTicket.findMany({
        where: { jellyfinUserId: user.userId },
        select: { id: true },
      });
      if (tickets.length > 0) {
        await prisma.supportTicket.deleteMany({ where: { jellyfinUserId: user.userId } });
      }
    } catch {
      // Non-blocking: Jellyfin user is already deleted
    }

    clearSessionCookie(reply);
    return { success: true, message: "Compte supprimé" };
  });

  /** POST /api/auth/password-reset-request — Create a support ticket for password reset. */
  app.post("/password-reset-request", {
    config: { rateLimit: { max: 3, timeWindow: 3_600_000 } },
  }, async (request, reply) => {
    const { username } = resetRequestSchema.parse(request.body);
    const jellyfinUrl = getJellyfinUrl();
    const apiKey = getJellyfinApiKey();

    // Always respond 200 to avoid leaking user existence
    const successResponse = { message: "Demande enregistrée" };

    if (!jellyfinUrl || !apiKey) {
      return reply.send(successResponse);
    }

    try {
      const res = await fetch(`${jellyfinUrl}/Users`, {
        headers: jellyfinAuthHeaders(apiKey),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return reply.send(successResponse);

      const users = (await res.json()) as { Id: string; Name: string }[];
      const match = users.find(
        (u) => u.Name.toLowerCase() === username.toLowerCase()
      );
      if (!match) return reply.send(successResponse);
      // Un invité de la Famille n'a pas de mot de passe à retrouver (personne ne le connaît).
      if (await isFamilyGuest(match.Id).catch(() => true)) return reply.send(successResponse);

      const prisma = getPrisma();
      await prisma.supportTicket.create({
        data: {
          jellyfinUserId: match.Id,
          username: match.Name,
          subject: "Réinitialisation de mot de passe",
          category: "account",
          status: "open",
          messages: {
            create: {
              jellyfinUserId: match.Id,
              username: match.Name,
              isAdmin: false,
              body: `L'utilisateur ${match.Name} demande une réinitialisation de son mot de passe.`,
            },
          },
        },
      });

      return reply.send(successResponse);
    } catch {
      return reply.send(successResponse);
    }
  });
};
