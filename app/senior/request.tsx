import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import type { ApiResponse, OutingRequest } from "../../lib/types";

const DESTINATION_TYPES = [
  { key: "grocery", label: "Grocery", color: colors.tileGreen },
  { key: "church", label: "Church", color: colors.tilePurple },
  { key: "park", label: "Park", color: colors.tileGreen },
  { key: "museum", label: "Museum", color: colors.tileGold },
  { key: "library", label: "Library", color: colors.tileCoral },
  { key: "restaurant", label: "Restaurant", color: colors.tileCoral },
  { key: "social_club", label: "Social Club", color: colors.tilePurple },
  { key: "other", label: "Other", color: colors.tileGold },
];

const TIME_SLOTS = [
  { key: "morning", label: "Morning", start: "09:00", end: "12:00", desc: "9am – 12pm" },
  { key: "afternoon", label: "Afternoon", start: "12:00", end: "16:00", desc: "12pm – 4pm" },
  { key: "evening", label: "Evening", start: "16:00", end: "19:00", desc: "4pm – 7pm" },
];

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getDateOptions() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    dates.push({ iso, label });
  }
  return dates;
}

export default function SeniorRequestScreen() {
  const router = useRouter();
  const { senior_id } = useLocalSearchParams<{ senior_id: string }>();

  const [destinationType, setDestinationType] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("morning");
  const [loading, setLoading] = useState(false);

  const dateOptions = getDateOptions();
  const timeSlot = TIME_SLOTS.find((t) => t.key === selectedTimeSlot)!;

  async function handleSubmit() {
    if (!destinationType) {
      Alert.alert("Required", "Please choose a destination type.");
      return;
    }
    if (!senior_id) {
      Alert.alert("Error", "No senior profile found. Please register first.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<ApiResponse<OutingRequest>>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          senior_id,
          destination_type: destinationType,
          destination_name: destinationName.trim(),
          preferred_date: selectedDate,
          preferred_time_start: timeSlot.start,
          preferred_time_end: timeSlot.end,
        }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else {
        Alert.alert(
          "Request Sent!",
          "We'll find nearby seniors going to the same place and match you with a volunteer driver.",
          [{ text: "View My Status", onPress: () => router.replace(`/senior/status?senior_id=${senior_id}`) }]
        );
      }
    } catch {
      Alert.alert("Error", "Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <Text style={styles.heading}>Request an{"\n"}<Text style={styles.headingAccent}>Outing</Text></Text>
      <Text style={styles.subheading}>We'll match you with nearby seniors going to the same place.</Text>

      {/* Destination type */}
      <Text style={styles.sectionLabel}>Where would you like to go?</Text>
      <View style={styles.destGrid}>
        {DESTINATION_TYPES.map((d) => {
          const selected = destinationType === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              style={[styles.destTile, { backgroundColor: selected ? d.color : colors.surface, borderColor: selected ? d.color : colors.border }]}
              onPress={() => setDestinationType(d.key)}
            >
              <Text style={[styles.destLabel, { color: selected ? "#fff" : colors.textPrimary }]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Optional destination name */}
      <Text style={styles.sectionLabel}>Specific place? <Text style={styles.optional}>(optional)</Text></Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={destinationName}
          onChangeText={setDestinationName}
          placeholder="e.g. Kroger on 21st Ave"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Date */}
      <Text style={styles.sectionLabel}>Which day?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll} contentContainerStyle={styles.dateScrollContent}>
        {dateOptions.map((d) => {
          const selected = selectedDate === d.iso;
          return (
            <TouchableOpacity
              key={d.iso}
              style={[styles.dateChip, selected && styles.dateChipSelected]}
              onPress={() => setSelectedDate(d.iso)}
            >
              <Text style={[styles.dateChipLabel, selected && styles.dateChipLabelSelected]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Time slot */}
      <Text style={styles.sectionLabel}>What time works?</Text>
      <View style={styles.timeRow}>
        {TIME_SLOTS.map((slot) => {
          const selected = selectedTimeSlot === slot.key;
          return (
            <TouchableOpacity
              key={slot.key}
              style={[styles.timeCard, selected && styles.timeCardSelected]}
              onPress={() => setSelectedTimeSlot(slot.key)}
            >
              <Text style={[styles.timeLabel, selected && styles.timeLabelSelected]}>{slot.label}</Text>
              <Text style={[styles.timeDesc, selected && styles.timeDescSelected]}>{slot.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Submit */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Find My Group</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

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
  },
  optional: {
    fontSize: fontSize.sm,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  destGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  destTile: {
    width: "47%",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
  },
  destLabel: {
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xl,
  },
  input: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  dateScroll: { marginBottom: spacing.xl },
  dateScrollContent: { gap: spacing.sm, paddingRight: spacing.lg },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dateChipLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dateChipLabelSelected: {
    color: colors.primary,
  },
  timeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  timeCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  timeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  timeLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  timeLabelSelected: { color: colors.primary },
  timeDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timeDescSelected: { color: colors.primary },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: spacing.md,
    alignItems: "center",
  },
  submitText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
