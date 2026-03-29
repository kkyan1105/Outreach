import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { saveAuth } from "../../lib/auth";
import type { ApiResponse } from "../../lib/types";
import type { AuthUser } from "../../lib/auth";

const INTERESTS = [
  { key: "grocery", label: "Grocery" },
  { key: "church", label: "Church" },
  { key: "park", label: "Park" },
  { key: "pharmacy", label: "Pharmacy" },
];

const VEHICLE_TYPES = [
  { key: "sedan", label: "Sedan" },
  { key: "suv", label: "SUV" },
  { key: "minivan", label: "Minivan" },
  { key: "accessible", label: "Wheelchair Accessible" },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "senior" | "volunteer" }>();
  const isSenior = role === "senior";
  const accentColor = isSenior ? colors.primary : colors.secondary;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [vehicleType, setVehicleType] = useState("sedan");
  const [maxPassengers, setMaxPassengers] = useState("4");
  const [loading, setLoading] = useState(false);

  function toggleInterest(key: string) {
    setInterests((prev: string[]) => prev.includes(key) ? prev.filter((k: string) => k !== key) : [...prev, key]);
  }
  async function handleRegister() {
    if (!name.trim() || !phone.trim() || !address.trim() || !password.trim()) {
      Alert.alert("Required", "Please fill in name, phone, address and password.");
      return;
    }
    setLoading(true);
    try {
      const body: any = {
        role,
        phone: phone.trim(),
        password,
        name: name.trim(),
        address: address.trim(),
      };
      if (isSenior) {
        body.interests = interests;
        body.emergency_contact_name = emergencyContactName.trim();
        body.emergency_contact_phone = emergencyContactPhone.trim();
      } else {
        body.vehicle_type = vehicleType;
        body.max_passengers = parseInt(maxPassengers) || 4;
      }

      const res = await api<ApiResponse<AuthUser>>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (res.error || !res.data) {
        Alert.alert("Registration failed", res.error || "Unknown error");
      } else {
        await saveAuth(res.data);
        if (res.data.role === "senior") {
          router.replace("/(senior)/home");
        } else {
          router.replace("/(volunteer)/dashboard");
        }
      }
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>
        {isSenior ? "Senior" : "Volunteer"}{"\n"}
        <Text style={[styles.headingAccent, { color: accentColor }]}>Registration</Text>
      </Text>
      <Text style={styles.subheading}>
        {isSenior
          ? "Join our community — we'll help you get out and connect."
          : "Give a ride, build a community. One trip serves 3–4 seniors."}
      </Text>

      {/* Basic info */}
      <View style={styles.card}>
        <Field label="Full Name *" value={name} onChangeText={setName} placeholder="e.g. Alice Johnson" />
        <Field label="Phone Number *" value={phone} onChangeText={setPhone} placeholder="615-555-0101" keyboardType="phone-pad" />
        {/* TODO: Replace with Google Places Autocomplete (react-native-google-places-autocomplete) for proper address validation and geocoding */}
        <Field label="Home Address *" value={address} onChangeText={setAddress} placeholder="123 Main St, Nashville, TN" />
        <Field label="Password *" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
        {isSenior && (
          <>
            <Field label="Emergency Contact Name" value={emergencyContactName} onChangeText={setEmergencyContactName} placeholder="e.g. John Smith" />
            <Field label="Emergency Contact Phone" value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} placeholder="615-555-0102" keyboardType="phone-pad" />
          </>
        )}
        {!isSenior && (
          <Field label="Max Passengers" value={maxPassengers} onChangeText={setMaxPassengers} placeholder="4" keyboardType="phone-pad" />
        )}
      </View>

      {/* Senior: interests */}
      {isSenior && (
        <>
          <Text style={styles.sectionLabel}>I enjoy going to…</Text>
          <View style={styles.chipGrid}>
            {INTERESTS.map((item) => {
              const selected = interests.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.chip, selected && styles.chipSelectedGreen]}
                  onPress={() => toggleInterest(item.key)}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelGreen]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Volunteer: vehicle */}
      {!isSenior && (
        <>
          <Text style={styles.sectionLabel}>Vehicle type</Text>
          <View style={styles.chipGrid}>
            {VEHICLE_TYPES.map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[styles.chip, vehicleType === v.key && styles.chipSelectedCoral]}
                onPress={() => setVehicleType(v.key)}
              >
                <Text style={[styles.chipLabel, vehicleType === v.key && styles.chipLabelCoral]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

        </>
      )}

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: accentColor }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace(`/auth/login?role=${role}`)}>
        <Text style={styles.switchLink}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, secure, multiline }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: "default" | "email-address" | "phone-pad";
  secure?: boolean; multiline?: boolean;
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
        secureTextEntry={secure}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 },
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
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: spacing.lg },
  backText: { fontSize: fontSize.sm, color: colors.textSecondary },
  heading: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.xs },
  headingAccent: { color: colors.primary },
  subheading: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 26, marginBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  sectionLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xl },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelectedGreen: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipSelectedCoral: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  chipLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  chipLabelGreen: { color: colors.primary },
  chipLabelCoral: { color: colors.secondary },
  submitButton: { borderRadius: radius.pill, padding: spacing.md, alignItems: "center", marginBottom: spacing.md },
  submitText: { fontSize: fontSize.lg, fontWeight: "700", color: "#FFFFFF" },
  switchLink: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center", textDecorationLine: "underline" },
});
