import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
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
    sublabel: "We're finding nearby seniors going to the same place.",
    color: colors.tileGold,
    bg: "#FFF8EC",
    dot: colors.tileGold,
  },
  matched: {
    label: "You're matched!",
    sublabel: "A volunteer driver has been assigned to your group.",
    color: colors.primary,
    bg: colors.primaryLight,
    dot: colors.primary,
  },
  completed: {
    label: "Completed",
    sublabel: "Hope you had a great outing!",
    color: colors.textSecondary,
    bg: colors.background,
    dot: colors.textSecondary,
  },
  cancelled: {
    label: "Cancelled",
    sublabel: "This outing was cancelled.",
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
      <Text style={styles.subheading}>Pull down to refresh and check your latest status.</Text>

      {requests.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🚗</Text>
          <Text style={styles.emptyTitle}>No requests yet</Text>
          <Text style={styles.emptyText}>
            Go to the Senior tab to request your first group outing!
          </Text>
        </View>
      )}

      {active.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Upcoming ({active.length})</Text>
          {active.map((req) => (
            <RequestCard key={req.id} request={req} />
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
  );
}

function RequestCard({ request }: { request: OutingRequest }) {
  const cfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const emoji = DESTINATION_EMOJI[request.destination_type] || "📍";
  const destLabel = request.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={styles.card}>
      {/* Top row */}
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={styles.statusSublabel}>{cfg.sublabel}</Text>
        </View>
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
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 26,
    marginBottom: spacing.xl,
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
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
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
  sectionLabel: {
    fontSize: fontSize.lg,
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
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
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
  destLabel: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  destName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  infoIcon: { fontSize: 14 },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  statusSublabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
