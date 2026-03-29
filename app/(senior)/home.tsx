import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { getAuth } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";

export default function SeniorHomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getAuth().then(setUser);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>Hello,</Text>
        <Text style={styles.name}>{user?.name || "there"} 👋</Text>
      </View>

      <Text style={styles.sectionTitle}>What would you like to do?</Text>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(senior)/request")}
      >
        <View style={styles.actionCardInner}>
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle}>Request an Outing</Text>
            <Text style={styles.actionSub}>Find a group going your way</Text>
          </View>
          <Text style={styles.actionEmoji}>🚗</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.tileGold }]}
        onPress={() => router.push("/(senior)/status")}
      >
        <View style={styles.actionCardInner}>
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle}>My Outings</Text>
            <Text style={styles.actionSub}>Check your request status</Text>
          </View>
          <Text style={styles.actionEmoji}>📋</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, { backgroundColor: colors.tilePurple }]}
        onPress={() => router.push("/(senior)/voice")}
      >
        <View style={styles.actionCardInner}>
          <View style={styles.actionTextBlock}>
            <Text style={styles.actionTitle}>Talk & Ride</Text>
            <Text style={styles.actionSub}>Book a trip by speaking — no typing needed</Text>
          </View>
          <Text style={styles.actionEmoji}>🎙️</Text>
        </View>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  headerRow: {
    marginBottom: spacing.sm,
  },
  greeting: { fontSize: fontSize.lg, color: colors.textSecondary },
  name: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actionCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  actionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionTextBlock: {
    flex: 1,
    marginRight: spacing.xs,
  },
  actionEmoji: { fontSize: 36, width: 40, textAlign: "center" },
  actionTitle: { fontSize: fontSize.xl, fontWeight: "800", color: "#fff", marginBottom: 6 },
  actionSub: { fontSize: fontSize.lg, color: "rgba(255,255,255,0.85)" },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },
});
