import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import type { ApiResponse } from "../../lib/types";

interface Senior {
  id: string;
  name: string;
  phone: string;
  address: string;
  mobility_notes: string;
}

interface OutingWithDetails {
  id: string;
  volunteer_id: string;
  scheduled_date: string;
  scheduled_time: string;
  destination_type: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  route_info: { reasoning?: string };
  seniors: Senior[];
}

const DESTINATION_EMOJI: Record<string, string> = {
  grocery: "🛒",
  church: "⛪",
  park: "🌳",
  museum: "🏛️",
  library: "📚",
  restaurant: "🍽️",
  social_club: "🎉",
  other: "📍",
};

const STATUS_CONFIG = {
  pending:   { label: "Awaiting your response", color: colors.tileGold,   bg: "#FFF8EC" },
  confirmed: { label: "Confirmed",               color: colors.primary,    bg: colors.primaryLight },
  completed: { label: "Completed",               color: colors.textSecondary, bg: colors.background },
  cancelled: { label: "Cancelled",               color: colors.secondary,  bg: colors.secondaryLight },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function VolunteerDashboardScreen() {
  const { volunteer_id } = useLocalSearchParams<{ volunteer_id: string }>();
  const [outings, setOutings] = useState<OutingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOutings = useCallback(async () => {
    if (!volunteer_id) return;
    try {
      const res = await api<ApiResponse<OutingWithDetails[]>>(
        `/api/outings?volunteer_id=${volunteer_id}`
      );
      if (res.data) setOutings(res.data);
    } catch {
      Alert.alert("Error", "Could not load outings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [volunteer_id]);

  useEffect(() => { fetchOutings(); }, [fetchOutings]);

  async function handleAction(outingId: string, status: "confirmed" | "cancelled") {
    setActionLoading(outingId + status);
    try {
      const res = await api<ApiResponse<OutingWithDetails>>(`/api/outings/${outingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else {
        setOutings((prev) =>
          prev.map((o) => (o.id === outingId ? { ...o, status } : o))
        );
      }
    } catch {
      Alert.alert("Error", "Could not update outing.");
    } finally {
      setActionLoading(null);
    }
  }

  if (!volunteer_id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No profile found</Text>
        <Text style={styles.emptyText}>Please register as a volunteer first.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={styles.loadingText}>Loading your outings…</Text>
      </View>
    );
  }

  const pending = outings.filter((o) => o.status === "pending");
  const others = outings.filter((o) => o.status !== "pending");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOutings(); }} tintColor={colors.secondary} />}
    >
      <Text style={styles.heading}>
        Volunteer{"\n"}<Text style={styles.headingAccent}>Dashboard</Text>
      </Text>
      <Text style={styles.subheading}>Pull down to refresh. Accept outings to help seniors get out.</Text>

      {outings.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No outings yet</Text>
          <Text style={styles.emptyText}>Once seniors are matched to you, they'll appear here.</Text>
        </View>
      )}

      {pending.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Needs your response ({pending.length})</Text>
          {pending.map((outing) => (
            <OutingCard
              key={outing.id}
              outing={outing}
              actionLoading={actionLoading}
              onAccept={() => handleAction(outing.id, "confirmed")}
              onDecline={() =>
                Alert.alert("Decline outing?", "The seniors will be re-matched with another volunteer.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Decline", style: "destructive", onPress: () => handleAction(outing.id, "cancelled") },
                ])
              }
            />
          ))}
        </>
      )}

      {others.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Past & confirmed</Text>
          {others.map((outing) => (
            <OutingCard key={outing.id} outing={outing} actionLoading={actionLoading} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function OutingCard({
  outing, actionLoading, onAccept, onDecline,
}: {
  outing: OutingWithDetails;
  actionLoading: string | null;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const statusCfg = STATUS_CONFIG[outing.status];
  const emoji = DESTINATION_EMOJI[outing.destination_type] || "📍";
  const isPending = outing.status === "pending";

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.destType}>
            {outing.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.dateTime}>
            {formatDate(outing.scheduled_date)} · {formatTime(outing.scheduled_time)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Passengers */}
      <View style={styles.divider} />
      <Text style={styles.passengersTitle}>
        {outing.seniors.length} passenger{outing.seniors.length !== 1 ? "s" : ""}
      </Text>
      {outing.seniors.map((senior) => (
        <View key={senior.id} style={styles.seniorRow}>
          <View style={styles.seniorDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.seniorName}>{senior.name}</Text>
            {senior.mobility_notes ? (
              <Text style={styles.seniorNote}>{senior.mobility_notes}</Text>
            ) : null}
          </View>
        </View>
      ))}

      {/* AI reasoning */}
      {outing.route_info?.reasoning && (
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningText}>"{outing.route_info.reasoning}"</Text>
        </View>
      )}

      {/* Actions */}
      {isPending && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={onDecline}
            disabled={!!actionLoading}
          >
            {actionLoading === outing.id + "cancelled" ? (
              <ActivityIndicator color={colors.secondary} size="small" />
            ) : (
              <Text style={styles.declineBtnText}>Decline</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={onAccept}
            disabled={!!actionLoading}
          >
            {actionLoading === outing.id + "confirmed" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.lg },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 40,
    marginBottom: spacing.xs,
  },
  headingAccent: { color: colors.secondary },
  subheading: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 26,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  emojiBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: { fontSize: 24 },
  destType: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  dateTime: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  passengersTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  seniorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: 6,
  },
  seniorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  seniorName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  seniorNote: {
    fontSize: fontSize.xs,
    color: colors.secondary,
    marginTop: 2,
  },
  reasoningBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  reasoningText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontStyle: "italic",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  declineBtn: {
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
  },
  declineBtnText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.secondary,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
