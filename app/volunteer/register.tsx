import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import type { ApiResponse, Volunteer } from "../../lib/types";

const VEHICLE_TYPES = [
  { key: "sedan", label: "Sedan" },
  { key: "suv", label: "SUV" },
  { key: "minivan", label: "Minivan" },
  { key: "accessible", label: "Wheelchair Accessible" },
];

const AVAILABILITY = [
  { key: "monday_morning", label: "Mon AM" },
  { key: "monday_afternoon", label: "Mon PM" },
  { key: "wednesday_morning", label: "Wed AM" },
  { key: "wednesday_afternoon", label: "Wed PM" },
  { key: "friday_morning", label: "Fri AM" },
  { key: "friday_afternoon", label: "Fri PM" },
  { key: "saturday_morning", label: "Sat AM" },
  { key: "saturday_afternoon", label: "Sat PM" },
  { key: "sunday_morning", label: "Sun AM" },
  { key: "sunday_afternoon", label: "Sun PM" },
];

export default function VolunteerRegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleType, setVehicleType] = useState("sedan");
  const [maxPassengers, setMaxPassengers] = useState("4");
  const [availability, setAvailability] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleAvailability(key: string) {
    setAvailability((prev: string[]) =>
      prev.includes(key) ? prev.filter((k: string) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit() {
    if (!name.trim() || !address.trim()) {
      Alert.alert("Required", "Please enter your name and address.");
      return;
    }
    if (availability.length === 0) {
      Alert.alert("Required", "Please select at least one availability slot.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<ApiResponse<Volunteer>>("/api/volunteers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          vehicle_type: vehicleType,
          max_passengers: parseInt(maxPassengers) || 4,
          availability,
        }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else {
        Alert.alert("Thank you!", `Welcome aboard, ${res.data?.name}! You'll be notified when seniors need a ride.`, [
          { text: "View Dashboard", onPress: () => router.replace(`/volunteer/dashboard?volunteer_id=${res.data?.id}`) },
        ]);
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
      <Text style={styles.heading}>Volunteer{"\n"}<Text style={styles.headingAccent}>Registration</Text></Text>
      <Text style={styles.subheading}>Give a ride, build a community. One trip serves 3–4 seniors.</Text>

      {/* Basic info */}
      <View style={styles.card}>
        <Field label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. David Chen" />
        <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="e.g. 615-555-0201" keyboardType="phone-pad" />
        <Field label="Home Address *" value={address} onChangeText={setAddress} placeholder="500 Church St, Nashville, TN" />
        <Field label="Max Passengers" value={maxPassengers} onChangeText={setMaxPassengers} placeholder="4" keyboardType="phone-pad" />
      </View>

      {/* Vehicle type */}
      <Text style={styles.sectionLabel}>Vehicle type</Text>
      <View style={styles.chipRow}>
        {VEHICLE_TYPES.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={[styles.chip, vehicleType === v.key && styles.chipSelected]}
            onPress={() => setVehicleType(v.key)}
          >
            <Text style={[styles.chipLabel, vehicleType === v.key && styles.chipLabelSelected]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Availability */}
      <Text style={styles.sectionLabel}>When are you available?</Text>
      <View style={styles.chipRow}>
        {AVAILABILITY.map((slot) => {
          const selected = availability.includes(slot.key);
          return (
            <TouchableOpacity
              key={slot.key}
              style={[styles.chip, selected && styles.chipSelectedCoral]}
              onPress={() => toggleAvailability(slot.key)}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelectedCoral]}>
                {slot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Submit */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Sign Up as Volunteer</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType || "default"}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.textPrimary,
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
  headingAccent: { color: colors.secondary },
  subheading: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 26,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipSelectedCoral: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight,
  },
  chipLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.primary,
  },
  chipLabelSelectedCoral: {
    color: colors.secondary,
  },
  submitButton: {
    backgroundColor: colors.secondary,
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
