import { View, Text, Pressable } from "react-native";
import type { SeerrMediaRequest } from "@tentacle-tv/api-client";

const REQUEST_STATUS: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "En attente", bg: "rgba(234,179,8,0.15)", text: "#eab308" },
  2: { label: "Approuvée", bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  3: { label: "Refusée", bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  4: { label: "Échec", bg: "rgba(185,28,28,0.15)", text: "#dc2626" },
  5: { label: "Complétée", bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
};

const MEDIA_STATUS: Record<number, { label: string; bg: string; text: string }> = {
  3: { label: "En cours", bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  4: { label: "Partiel", bg: "rgba(249,115,22,0.15)", text: "#f97316" },
  5: { label: "Disponible", bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
};

interface Props {
  req: SeerrMediaRequest;
  onDelete: (id: number) => void;
  onRetry: (p: { requestId: number; mediaType: "movie" | "tv"; mediaId: number }) => void;
}

export function MobileRequestRow({ req, onDelete, onRetry }: Props) {
  const reqStatus = REQUEST_STATUS[req.status];
  const mediaStatus = MEDIA_STATUS[req.media?.status];
  const date = new Date(req.createdAt).toLocaleDateString("fr-FR");
  const isFailed = req.status === 4;
  const isDeclined = req.status === 3;

  return (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: "#1e1e2e",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>#{req.media?.tmdbId}</Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>
                {req.media?.mediaType === "movie" ? "Film" : "Série"}
              </Text>
            </View>
          </View>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
            {req.requestedBy?.displayName || req.requestedBy?.username || "Utilisateur"} — {date}
          </Text>
        </View>

        {/* Status badges */}
        <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
          {reqStatus && (
            <View style={{ backgroundColor: reqStatus.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ color: reqStatus.text, fontSize: 11, fontWeight: "600" }}>{reqStatus.label}</Text>
            </View>
          )}
          {mediaStatus && (
            <View style={{ backgroundColor: mediaStatus.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ color: mediaStatus.text, fontSize: 11, fontWeight: "600" }}>{mediaStatus.label}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {(isFailed || isDeclined) && (
          <Pressable
            onPress={() => onRetry({ requestId: req.id, mediaType: req.media?.mediaType, mediaId: req.media?.tmdbId })}
            style={{ backgroundColor: "rgba(139,92,246,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
          >
            <Text style={{ color: "#8b5cf6", fontSize: 12, fontWeight: "600" }}>Re-demander</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onDelete(req.id)}
          style={{ backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
        >
          <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>Supprimer</Text>
        </Pressable>
      </View>
    </View>
  );
}
