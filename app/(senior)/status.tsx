import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse, OutingRequest } from "../../lib/types";

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
  pending: {
    label: "Looking for a group…",
    color: colors.tileGold,
    bg: "#FFF8EC",
    dot: colors.tileGold,
  },
  matched: {
    label: "You're matched!",
    color: colors.primary,
    bg: colors.primaryLight,
    dot: colors.primary,
  },
  completed: {
    label: "Completed",
    color: colors.textSecondary,
    bg: colors.background,
    dot: colors.textSecondary,
  },
  cancelled: {
    label: "Cancelled",
    color: colors.secondary,
    bg: colors.secondaryLight,
    dot: colors.secondary,
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function SeniorStatusScreen() {
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [requests, setRequests] = useState<OutingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OutingRequest | null>(null);

  useEffect(() => {
    getAuth().then((user) => setSeniorId(user?.id || null));
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!seniorId) return;
    try {
      const res = await api<ApiResponse<OutingRequest[]>>(
        `/api/requests?senior_id=${seniorId}`
      );
      if (res.data) setRequests(res.data);
    } catch {
      Alert.alert("Error", "Could not load your requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seniorId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      const res = await api<ApiResponse<OutingRequest>>(`/api/requests/${cancelTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.error) Alert.alert("Error", res.error);
      else fetchRequests();
    } catch {
      Alert.alert("Error", "Could not cancel request.");
    } finally {
      setCancelTarget(null);
    }
  }

  if (!seniorId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No profile found</Text>
        <Text style={styles.emptyText}>Please register as a senior first.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your outings…</Text>
      </View>
    );
  }

  const active = requests.filter((r) => r.status === "pending" || r.status === "matched");
  const past = requests.filter((r) => r.status === "completed" || r.status === "cancelled");

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRequests(); }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.heading}>
          My{"\n"}<Text style={styles.headingAccent}>Outings</Text>
        </Text>
        <Text style={styles.subheading}>Pull down to refresh for latest status.</Text>

        {requests.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🚗</Text>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptyText}>
              Go to the Home tab to request your first group outing!
            </Text>
          </View>
        )}

        {active.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Upcoming ({active.length})</Text>
            {active.map((req) => (
              <RequestCard key={req.id} request={req} onCancel={() => setCancelTarget(req)} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Past</Text>
            {past.map((req) => (
              <RequestCard key={req.id} request={req} />
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!cancelTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cancel this outing?</Text>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={confirmCancel}>
              <Text style={styles.modalCancelBtnText}>Yes, Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalKeepBtn} onPress={() => setCancelTarget(null)}>
              <Text style={styles.modalKeepBtnText}>Keep It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function RequestCard({ request, onCancel }: { request: OutingRequest; onCancel?: () => void }) {
  const cfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const emoji = DESTINATION_EMOJI[request.destination_type] || "📍";
  const destLabel = request.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const canCancel = !!onCancel && (request.status === "pending" || request.status === "matched");

  return (
    <View style={styles.card}>
      {/* Top row: emoji + destination + trash icon */}
      <View style={styles.cardTop}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.destLabel}>{destLabel}</Text>
          {request.destination_name ? (
            <Text style={styles.destName}>{request.destination_name}</Text>
          ) : null}
        </View>
        {canCancel && (
          <TouchableOpacity style={styles.trashBtn} onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash" size={28} color={colors.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date & time */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoText}>{formatDate(request.preferred_date)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoIcon}>🕐</Text>
          <Text style={styles.infoText}>
            {formatTime(request.preferred_time_start)} – {formatTime(request.preferred_time_end)}
          </Text>
        </View>
      </View>

      {/* Status banner */}
      <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
        <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        {request.status === "pending" && (
          <ActivityIndicator size="small" color={cfg.color} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 40,
    marginBottom: spacing.xs,
  },
  headingAccent: { color: colors.primary },
  subheading: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    lineHeight: 28,
    marginBottom: spacing.xs,
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
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
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
    lineHeight: 26,
  },
  sectionLabel: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emojiBox: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: { fontSize: 28 },
  destLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary },
  destName: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },
  trashBtn: {
    padding: 8,
    borderRadius: radius.sm,
  },
  infoRow: { gap: spacing.xs },
  infoItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  infoIcon: { fontSize: 18 },
  infoText: { fontSize: fontSize.md, color: colors.textSecondary },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: { fontSize: fontSize.md, fontWeight: "700" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: "100%",
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  modalCancelBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  modalCancelBtnText: {
    fontSize: fontSize.md,
    fontWeight: "800",
    color: "#fff",
  },
  modalKeepBtn: {
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalKeepBtnText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
