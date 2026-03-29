import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse } from "../../lib/types";

const DESTINATION_EMOJI: Record<string, string> = {
  grocery: "🛒",
  church: "⛪",
  park: "🌳",
  museum: "🏛️",
  library: "📚",
  restaurant: "🍽️",
  social_club: "🎉",
  pharmacy: "💊",
  other: "📍",
};

const MAX_PASSENGERS = 4;

interface OpenOuting {
  id: string;
  destination_type: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  request_ids: string[];
  seniors: { id: string; name: string }[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(timeStr: string) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function GroupsScreen() {
  const router = useRouter();
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [outings, setOutings] = useState<OpenOuting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    getAuth().then((user) => setSeniorId(user?.id || null));
  }, []);

  const fetchOutings = useCallback(async () => {
    if (!seniorId) return;
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        api<ApiResponse<OpenOuting[]>>("/api/outings?status=pending"),
        api<ApiResponse<OpenOuting[]>>("/api/outings?status=confirmed"),
      ]);
      const all = [...(pendingRes.data || []), ...(confirmedRes.data || [])];
      const joinable = all.filter((o) => {
        const alreadyIn = (o.seniors || []).some((s) => s.id === seniorId);
        const spots = MAX_PASSENGERS - (o.request_ids || []).length;
        return !alreadyIn && spots > 0;
      });
      setOutings(joinable);
    } catch {
      Alert.alert("Error", "Could not load groups.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seniorId]);

  useEffect(() => { fetchOutings(); }, [fetchOutings]);

  async function handleJoin(outing: OpenOuting) {
    if (!seniorId) return;
    const destLabel = outing.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    Alert.alert(
      "Join this outing?",
      `${destLabel} · ${formatDate(outing.scheduled_date)} at ${formatTime(outing.scheduled_time)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Join",
          onPress: async () => {
            setJoiningId(outing.id);
            try {
              const res = await api<ApiResponse<any>>(`/api/outings/${outing.id}/join`, {
                method: "POST",
                body: JSON.stringify({ senior_id: seniorId }),
              });
              if (res.error) {
                Alert.alert("Could not join", res.error);
              } else {
                Alert.alert(
                  "You're in!",
                  "You've joined the group. Check My Outings for updates.",
                  [
                    { text: "View My Outings", onPress: () => router.replace("/(senior)/status") },
                    { text: "OK", onPress: () => fetchOutings() },
                  ]
                );
              }
            } catch {
              Alert.alert("Error", "Could not join. Please try again.");
            } finally {
              setJoiningId(null);
            }
          },
        },
      ]
    );
  }

  if (!seniorId || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding groups near you…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchOutings(); }}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.heading}>
        Groups{"\n"}<Text style={styles.headingAccent}>Near You</Text>
      </Text>
      <Text style={styles.subheading}>Pull down to refresh. Join a group that's already forming!</Text>

      {outings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No open groups right now</Text>
          <Text style={styles.emptyText}>
            Be the first — request an outing and others nearby can join you.
          </Text>
        </View>
      ) : (
        outings.map((outing) => {
          const emoji = DESTINATION_EMOJI[outing.destination_type] || "📍";
          const destLabel = outing.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const peopleCount = (outing.seniors || []).length;
          const spots = MAX_PASSENGERS - (outing.request_ids || []).length;
          const isJoining = joiningId === outing.id;

          return (
            <View key={outing.id} style={styles.card}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.emojiBox}>
                  <Text style={styles.emoji}>{emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.destLabel}>{destLabel}</Text>
                  <Text style={styles.spotsText}>
                    {peopleCount} {peopleCount === 1 ? "person" : "people"} going · {spots} spot{spots !== 1 ? "s" : ""} left
                  </Text>
                </View>
              </View>

              {/* Date & time */}
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>📅</Text>
                  <Text style={styles.infoText}>{formatDate(outing.scheduled_date)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>🕐</Text>
                  <Text style={styles.infoText}>{formatTime(outing.scheduled_time)}</Text>
                </View>
              </View>

              {/* Status badge */}
              <View style={[styles.statusBadge, outing.status === "confirmed" ? styles.statusConfirmed : styles.statusPending]}>
                <View style={[styles.statusDot, { backgroundColor: outing.status === "confirmed" ? colors.primary : colors.tileGold }]} />
                <Text style={[styles.statusText, { color: outing.status === "confirmed" ? colors.primary : colors.tileGold }]}>
                  {outing.status === "confirmed" ? "Driver assigned" : "Forming — no driver yet"}
                </Text>
              </View>

              {/* Join button */}
              <TouchableOpacity
                style={[styles.joinBtn, isJoining && styles.joinBtnDisabled]}
                onPress={() => handleJoin(outing)}
                disabled={isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={22} color="#fff" />
                    <Text style={styles.joinBtnText}>Join this group</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: colors.background, padding: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xxl, fontWeight: "800",
    color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.xs,
  },
  headingAccent: { color: colors.tileGreen },
  subheading: {
    fontSize: fontSize.lg, color: colors.textSecondary,
    lineHeight: 28, marginBottom: spacing.lg,
  },
  loadingText: { marginTop: spacing.sm, fontSize: fontSize.md, color: colors.textSecondary },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.xl, alignItems: "center",
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", lineHeight: 26 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emojiBox: {
    width: 56, height: 56, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center",
  },
  emoji: { fontSize: 28 },
  destLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary },
  spotsText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },
  infoRow: { gap: spacing.xs },
  infoItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  infoIcon: { fontSize: 18 },
  infoText: { fontSize: fontSize.md, color: colors.textSecondary },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderRadius: radius.sm, padding: spacing.sm,
  },
  statusPending: { backgroundColor: "#FFF8EC" },
  statusConfirmed: { backgroundColor: colors.primaryLight },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: fontSize.md, fontWeight: "600" },
  joinBtn: {
    backgroundColor: colors.tileGreen, borderRadius: radius.pill,
    paddingVertical: 16, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: spacing.xs,
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { fontSize: fontSize.lg, fontWeight: "700", color: "#fff" },
});
