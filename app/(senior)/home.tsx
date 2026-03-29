import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { getAuth, clearAuth } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";

export default function SeniorHomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getAuth().then(setUser);
  }, []);

  async function handleLogout() {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out", style: "destructive", onPress: async () => {
          await clearAuth();
          router.replace("/");
        }
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{user?.name || "there"} 👋</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>What would you like to do?</Text>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(senior)/request")}
      >
        <Text style={styles.actionEmoji}>🚗</Text>
        <Text style={styles.actionTitle}>Request an Outing</Text>
        <Text style={styles.actionSub}>Find a group going your way</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.tileGold }]}
        onPress={() => router.push("/(senior)/status")}
      >
        <Text style={styles.actionEmoji}>📋</Text>
        <Text style={styles.actionTitle}>My Outings</Text>
        <Text style={styles.actionSub}>Check your request status</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.tilePurple }]}
        onPress={() => router.push("/(senior)/voice")}
      >
        <Text style={styles.actionEmoji}>🎙️</Text>
        <Text style={styles.actionTitle}>Talk & Ride</Text>
        <Text style={styles.actionSub}>Book a trip by speaking — no typing needed</Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          Request an outing → We match you with nearby seniors → A volunteer driver picks everyone up together 🎉
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xl,
  },
  greeting: { fontSize: fontSize.md, color: colors.textSecondary },
  name: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  logoutBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logoutText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "600" },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actionCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  actionEmoji: { fontSize: 36, marginBottom: spacing.xs },
  actionTitle: { fontSize: fontSize.xl, fontWeight: "800", color: "#fff", marginBottom: 4 },
  actionSub: { fontSize: fontSize.md, color: "rgba(255,255,255,0.85)" },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },
});
