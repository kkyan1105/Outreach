import { View, Text, StyleSheet } from "react-native";
import { colors, fontSize, radius, spacing } from "../lib/theme";

interface OutingCardProps {
  destinationType: string;
  scheduledDate: string;
  scheduledTime: string;
  seniors: { id: string; name: string }[];
  volunteer: { name: string; vehicle_type: string } | null;
  status: string;
  reasoning?: string;
}

const DEST_COLORS: Record<string, string> = {
  grocery: colors.tileGreen,
  church: colors.tilePurple,
  park: colors.tileGreen,
  museum: colors.tileGold,
  library: colors.tileCoral,
  restaurant: colors.tileCoral,
  social_club: colors.tilePurple,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  confirmed: { bg: "#D1FAE5", text: "#065F46" },
  completed: { bg: colors.primaryLight, text: colors.primary },
  cancelled: { bg: "#FEE2E2", text: "#991B1B" },
};

export default function OutingCard({
  destinationType,
  scheduledDate,
  scheduledTime,
  seniors,
  volunteer,
  status,
  reasoning,
}: OutingCardProps) {
  const destColor = DEST_COLORS[destinationType] || colors.primary;
  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.pending;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.destBadge, { backgroundColor: destColor }]}>
          <Text style={styles.destText}>{destinationType}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{status}</Text>
        </View>
      </View>

      {/* Date & time */}
      <Text style={styles.dateTime}>{scheduledDate} at {scheduledTime}</Text>

      {/* Seniors list */}
      <Text style={styles.sectionLabel}>Passengers ({seniors.length})</Text>
      {seniors.map((s) => (
        <Text key={s.id} style={styles.seniorName}>  {s.name}</Text>
      ))}

      {/* Volunteer */}
      {volunteer && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>Driver</Text>
          <Text style={styles.seniorName}>  {volunteer.name} ({volunteer.vehicle_type})</Text>
        </>
      )}

      {/* Reasoning */}
      {reasoning && (
        <Text style={styles.reasoning}>{reasoning}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  destBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  destText: {
    color: "#fff",
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  dateTime: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  seniorName: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  reasoning: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
