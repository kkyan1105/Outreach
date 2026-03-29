import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse } from "../../lib/types";

interface Senior {
  id: string;
  name: string;
  phone: string;
  address: string;
  preferred_time_start?: string;
  preferred_time_end?: string;
  destination_name?: string;
}

interface OutingWithDetails {
  id: string;
  volunteerId: string;
  scheduled_date: string;
  scheduled_time: string;
  destination_type: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  route_info: { reasoning?: string };
  seniors: Senior[];
}

const DESTINATION_EMOJI: Record<string, string> = {
  grocery: "\u{1F6D2}",
  church: "\u26EA",
  park: "\u{1F333}",
  museum: "\u{1F3DB}\uFE0F",
  library: "\u{1F4DA}",
  restaurant: "\u{1F37D}\uFE0F",
  social_club: "\u{1F389}",
  other: "\u{1F4CD}",
  pharmacy: "\u{1F48A}",
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

function isOutingInPast(outing: OutingWithDetails): boolean {
  const now = new Date();
  const [h, m] = (outing.scheduled_time || "00:00").split(":").map(Number);
  const outingDate = new Date(outing.scheduled_date + "T00:00:00");
  outingDate.setHours(h, m, 0, 0);
  return outingDate < now;
}

export default function VolunteerDashboardScreen() {
  const router = useRouter();
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [outings, setOutings] = useState<OutingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [routePlans, setRoutePlans] = useState<Record<string, any>>({});

  useEffect(() => {
    getAuth().then((user) => {
      setVolunteerId(user?.id || null);
    });
  }, []);

  const fetchOutings = useCallback(async () => {
    if (!volunteerId) return;
    try {
      // Fetch my claimed outings + available unclaimed outings
      const [myRes, availRes] = await Promise.all([
        api<ApiResponse<OutingWithDetails[]>>(`/api/outings?volunteer_id=${volunteerId}`),
        api<ApiResponse<OutingWithDetails[]>>(`/api/outings/available?volunteer_id=${volunteerId}`),
      ]);
      const myOutings = myRes.data || [];
      const available = availRes.data || [];
      // Mark available ones so we know they're unclaimed
      const tagged = available.map((o: any) => ({ ...o, _unclaimed: true }));
      setOutings([...myOutings, ...tagged]);

      // Fetch route plans for confirmed outings
      const confirmed = myOutings.filter((o: any) => o.status === "confirmed" && !isOutingInPast(o));
      for (const o of confirmed) {
        api<ApiResponse<any>>(`/api/route/${o.id}`)
          .then((r) => { if (r.data) setRoutePlans((prev) => ({ ...prev, [o.id]: r.data })); })
          .catch(() => {});
      }
    } catch {
      Alert.alert("Error", "Could not load outings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [volunteerId]);

  // Re-fetch every time the tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchOutings();
    }, [fetchOutings])
  );

  async function handleAction(outingId: string, status: "confirmed" | "cancelled") {
    setActionLoading(outingId + status);
    try {
      const body: any = { status };
      if (status === "confirmed") body.volunteer_id = volunteerId;
      const res = await api<ApiResponse<OutingWithDetails>>(`/api/outings/${outingId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else {
        // Refresh immediately
        fetchOutings();
        // Refresh again after auto-match has time to run
        if (status === "cancelled") {
          setTimeout(() => fetchOutings(), 3000);
          setTimeout(() => fetchOutings(), 6000);
        }
      }
    } catch {
      Alert.alert("Error", "Could not update outing.");
    } finally {
      setActionLoading(null);
    }
  }

  if (!volunteerId) {
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
        <Text style={styles.loadingText}>Loading your outings...</Text>
      </View>
    );
  }

  const available = outings.filter((o: any) => o._unclaimed && o.status === "pending");
  const confirmed = outings.filter((o) => o.status === "confirmed" && !isOutingInPast(o));
  const past = outings.filter((o) => (o.status === "confirmed" || o.status === "completed") && isOutingInPast(o));
  const cancelled = outings.filter((o) => o.status === "cancelled");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOutings(); }} tintColor={colors.secondary} />}
    >
      <Text style={styles.heading}>
        Volunteer{"\n"}<Text style={styles.headingAccent}>Dashboard</Text>
      </Text>
      <Text style={styles.subheading}>Small drives, big connections.</Text>

      {outings.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No outings yet</Text>
          <Text style={styles.emptyText}>Once seniors are matched to you, they'll appear here.</Text>
        </View>
      )}

      {available.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Available for you ({available.length})</Text>
          {available.map((outing) => (
            <OutingCard
              key={outing.id}
              outing={outing}
              actionLoading={actionLoading}
              variant="pending"
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

      {confirmed.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Confirmed ({confirmed.length})</Text>
          {confirmed.map((outing) => (
            <OutingCard
              key={outing.id}
              outing={outing}
              actionLoading={actionLoading}
              variant="confirmed"
              routePlan={routePlans[outing.id]}
              onPress={() => router.push(`/(volunteer)/trip?outing_id=${outing.id}`)}
              onCancel={() =>
                Alert.alert("Cancel outing?", "This will free the ride for another volunteer.", [
                  { text: "Keep", style: "cancel" },
                  { text: "Cancel Outing", style: "destructive", onPress: () => handleAction(outing.id, "cancelled") },
                ])
              }
            />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Past ({past.length})</Text>
          {past.map((outing) => (
            <OutingCard key={outing.id} outing={outing} actionLoading={actionLoading} variant="past" />
          ))}
        </>
      )}

      {cancelled.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Cancelled ({cancelled.length})</Text>
          {cancelled.map((outing) => (
            <OutingCard key={outing.id} outing={outing} actionLoading={actionLoading} variant="past" />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function OutingCard({
  outing, actionLoading, variant, onAccept, onDecline, onCancel, onPress, routePlan,
}: {
  outing: OutingWithDetails;
  actionLoading: string | null;
  variant: "pending" | "confirmed" | "past";
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onPress?: () => void;
  routePlan?: any;
}) {
  const statusCfg = variant === "past"
    ? { label: "Past", color: colors.textSecondary, bg: colors.background }
    : STATUS_CONFIG[outing.status];
  const emoji = DESTINATION_EMOJI[outing.destination_type] || "\u{1F4CD}";

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper style={styles.card} {...wrapperProps}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.destType}>
            {outing.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.dateTime}>{formatDate(outing.scheduled_date)}</Text>
          <Text style={styles.dateTime}>Depart: {formatTime(routePlan?.departure_time || outing.scheduled_time)}</Text>
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
      {outing.seniors.map((senior) => {
        // If we have a route plan, show planned ETA instead of time window
        const plannedStop = routePlan?.stops?.find((s: any) => s.senior_id === senior.id);
        return (
          <View key={senior.id} style={styles.seniorRow}>
            <View style={styles.seniorDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.seniorName}>{senior.name}</Text>
              {plannedStop ? (
                <Text style={styles.seniorTime}>Pickup: {formatTime(plannedStop.eta)}</Text>
              ) : senior.preferred_time_start && senior.preferred_time_end ? (
                <Text style={styles.seniorTime}>
                  {formatTime(senior.preferred_time_start)} – {formatTime(senior.preferred_time_end)}
                </Text>
              ) : null}
              {senior.address ? (
                <Text style={styles.seniorAddress}>{senior.address}</Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {/* Actions — pending: Accept/Decline */}
      {variant === "pending" && (
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

      {/* Actions — confirmed (future): Cancel */}
      {variant === "confirmed" && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={onCancel}
            disabled={!!actionLoading}
          >
            {actionLoading === outing.id + "cancelled" ? (
              <ActivityIndicator color={colors.secondary} size="small" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* View route link for confirmed outings */}
      {variant === "confirmed" && (
        <Text style={styles.viewRouteText}>View Route →</Text>
      )}
    </Wrapper>
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
  seniorTime: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.tileGold,
    marginTop: 2,
  },
  seniorAddress: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
  cancelBtn: {
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
  },
  cancelBtnText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.secondary,
  },
  viewRouteText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
    textAlign: "right",
    marginTop: spacing.sm,
  },
});
