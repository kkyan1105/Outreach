import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import type { ApiResponse, Senior } from "../../lib/types";

const INTERESTS = [
  { key: "grocery", label: "Grocery" },
  { key: "church", label: "Church" },
  { key: "park", label: "Park" },
  { key: "museum", label: "Museum" },
  { key: "library", label: "Library" },
  { key: "restaurant", label: "Restaurant" },
];

export default function SeniorRegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mobilityNotes, setMobilityNotes] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleInterest(key: string) {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit() {
    if (!name.trim() || !address.trim()) {
      Alert.alert("Required", "Please enter your name and address.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<ApiResponse<Senior>>("/api/seniors", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          interests,
          mobility_notes: mobilityNotes.trim(),
          emergency_contact: emergencyContact.trim(),
        }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else {
        Alert.alert("Welcome!", `You're registered, ${res.data?.name}!`, [
          { text: "Request an Outing", onPress: () => router.replace(`/senior/request?senior_id=${res.data?.id}`) },
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
      <Text style={styles.heading}>Senior{"\n"}<Text style={styles.headingAccent}>Registration</Text></Text>
      <Text style={styles.subheading}>Join our community — we'll help you get out and connect.</Text>

      {/* Form */}
      <View style={styles.card}>
        <Field label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. Alice Johnson" />
        <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="e.g. 615-555-0101" keyboardType="phone-pad" />
        <Field label="Home Address *" value={address} onChangeText={setAddress} placeholder="123 Main St, Nashville, TN" />
        <Field label="Emergency Contact" value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Name & phone number" />
        <Field label="Mobility Notes" value={mobilityNotes} onChangeText={setMobilityNotes} placeholder="e.g. Uses a walker, wheelchair needed…" multiline />
      </View>

      {/* Interests */}
      <Text style={styles.sectionLabel}>I enjoy going to…</Text>
      <View style={styles.interestGrid}>
        {INTERESTS.map((item) => {
          const selected = interests.includes(item.key);
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.interestChip, selected && styles.interestChipSelected]}
              onPress={() => toggleInterest(item.key)}
            >
              <Text style={[styles.interestLabel, selected && styles.interestLabelSelected]}>
                {item.label}
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
          <Text style={styles.submitText}>Register</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
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
  inputMulti: {
    minHeight: 80,
    textAlignVertical: "top",
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
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  interestChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  interestChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  interestLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  interestLabelSelected: {
    color: colors.primary,
  },
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
