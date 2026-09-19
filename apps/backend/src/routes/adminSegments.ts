/**
 * L'analyse audio des passages, vue de l'administrateur : l'interrupteur, l'outil
 * d'empreinte trouvé sur ce serveur, et ce que la fonction a coûté depuis le
 * démarrage (fenêtres transcodées, octets, secondes, verdicts). C'est ce qui
 * permet de décider en connaissance de cause de la laisser allumée.
 *
 * À part d'`admin.ts`, qui frôle les trois cents lignes.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { audioAnalysisCounters } from "../services/audioAnalysis";
import { detectFingerprintTool } from "../services/audioFingerprintTool";
import { isAudioAnalysisEnabled, setConfigValue } from "../services/configStore";

const putSchema = z.object({ enabled: z.boolean() });

export const adminSegmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/audio-analysis", async () => {
    const tool = await detectFingerprintTool();
    return {
      enabled: isAudioAnalysisEnabled(),
      tool: tool === null ? null : tool.kind,
      counters: audioAnalysisCounters(),
    };
  });

  app.put("/audio-analysis", async (request, reply) => {
    const parsed = putSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message });
    }
    await setConfigValue("audio_analysis_enabled", String(parsed.data.enabled));
    return { success: true, enabled: parsed.data.enabled };
  });
};
