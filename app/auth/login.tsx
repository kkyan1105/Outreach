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

export default function LoginScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "senior" | "volunteer" }>();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isSenior = role === "senior";
  const accentColor = isSenior ? colors.primary : colors.secondary;

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your phone number and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api<ApiResponse<AuthUser>>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ role, phone: phone.trim(), password }),
      });
      if (res.error || !res.data) {
        Alert.alert("Login failed", res.error || "Unknown error");
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
        Welcome{"\n"}<Text style={[styles.headingAccent, { color: accentColor }]}>back</Text>
      </Text>
      <Text style={styles.subheading}>
        Logging in as a <Text style={{ fontWeight: "700" }}>{role}</Text>
      </Text>

      <View style={styles.card}>
        <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="615-555-0101" keyboardType="phone-pad" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: accentColor }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Log In</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace(`/auth/register?role=${role}`)}>
        <Text style={styles.switchLink}>Don't have an account? Register here</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, secure }: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  secure?: boolean;
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
        secureTextEntry={secure}
        autoCapitalize="none"
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
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: spacing.lg },
  backText: { fontSize: fontSize.sm, color: colors.textSecondary },
  heading: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.xs },
  headingAccent: { color: colors.primary },
  subheading: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 26 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  submitButton: { borderRadius: radius.pill, padding: spacing.md, alignItems: "center", marginBottom: spacing.md },
  submitText: { fontSize: fontSize.lg, fontWeight: "700", color: "#FFFFFF" },
  switchLink: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center", textDecorationLine: "underline" },
});
