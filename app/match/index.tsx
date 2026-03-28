import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import OutingCard from "../../components/OutingCard";
import type { ApiResponse } from "../../lib/types";

interface Stats {
  seniors: number;
  volunteers: number;
  requests: { pending: number; matched: number };
  outings: { pending: number; confirmed: number; completed: number };
}

interface MatchResultData {
  groups: {
    senior_ids: string[];
    volunteer_id: string;
    suggested_time: string;
    destination_type: string;
    reasoning: string;
  }[];
  unmatched_seniors: string[];
  unmatched_reason: string;
  outings_created: number;
}

interface OutingData {
  id: string;
  volunteer_id: string;
  scheduled_date: string;
  scheduled_time: string;
  destination_type: string;
  status: string;
  route_info: { reasoning?: string };
  seniors: { id: string; name: string }[];
  volunteer: { name: string; vehicle_type: string } | null;
}

export default function MatchScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [outings, setOutings] = useState<OutingData[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, outingsRes] = await Promise.all([
        api<ApiResponse<Stats>>("/api/stats"),
        api<ApiResponse<OutingData[]>>("/api/outings"),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (outingsRes.data) setOutings(outingsRes.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleMatch() {
    setMatchLoading(true);
    setMatchResult(null);
    try {
      const res = await api<ApiResponse<MatchResultData>>("/api/match", {
        method: "POST",
      });
      if (res.error) {
        Alert.alert("Matching Error", res.error);
      } else if (res.data) {
        setMatchResult(res.data);
        // Reload outings and stats
        await loadData();
      }
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setMatchLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Outing{"\n"}<Text style={styles.headingAccent}>Manager</Text></Text>

      {/* Stats */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatBox label="Seniors" value={stats.seniors} color={colors.primary} />
          <StatBox label="Volunteers" value={stats.volunteers} color={colors.secondary} />
          <StatBox label="Pending" value={stats.requests.pending} color={colors.tileGold} />
          <StatBox label="Matched" value={stats.requests.matched} color={colors.tileGreen} />
        </View>
      )}

      {/* Match button */}
      <TouchableOpacity
        style={styles.matchButton}
        onPress={handleMatch}
        disabled={matchLoading}
      >
        {matchLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.matchButtonText}>Run AI Matching</Text>
            <Text style={styles.matchButtonSub}>Group seniors + assign volunteers</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Match result */}
      {matchResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Matching Complete</Text>
          <Text style={styles.resultStat}>
            {matchResult.groups.length} group{matchResult.groups.length !== 1 ? "s" : ""} created
          </Text>
          {matchResult.unmatched_seniors.length > 0 && (
            <View style={styles.unmatchedBox}>
              <Text style={styles.unmatchedLabel}>
                {matchResult.unmatched_seniors.length} senior{matchResult.unmatched_seniors.length !== 1 ? "s" : ""} unmatched
              </Text>
              <Text style={styles.unmatchedReason}>{matchResult.unmatched_reason}</Text>
            </View>
          )}
        </View>
      )}

      {/* Outings list */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>All Outings</Text>
        <TouchableOpacity onPress={loadData}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}

      {!loading && outings.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No outings yet. Run AI Matching to create groups.</Text>
        </View>
      )}

      {outings.map((outing) => (
        <OutingCard
          key={outing.id}
          destinationType={outing.destination_type}
          scheduledDate={outing.scheduled_date}
          scheduledTime={outing.scheduled_time}
          seniors={outing.seniors}
          volunteer={outing.volunteer}
          status={outing.status}
          reasoning={outing.route_info?.reasoning}
        />
      ))}
    </ScrollView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={statStyles.box}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: "800",
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 40,
    marginBottom: spacing.xs,
  },
  headingAccent: { color: colors.primary },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  matchButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  matchButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  matchButtonSub: {
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  resultCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  resultTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  resultStat: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  unmatchedBox: {
    marginTop: spacing.sm,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  unmatchedLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#92400E",
  },
  unmatchedReason: {
    fontSize: fontSize.xs,
    color: "#92400E",
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  refreshText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
