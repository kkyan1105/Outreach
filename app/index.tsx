import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../lib/theme";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Elderly{" "}
          <Text style={styles.titleAccent}>Care</Text>
        </Text>
        <Text style={styles.subtitle}>
          AI-powered group outings for seniors.{"\n"}No one rides alone.
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>6M</Text>
          <Text style={styles.statLabel}>seniors stranded{"\n"}at home</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.secondaryLight }]}>
          <Text style={[styles.statNumber, { color: colors.secondary }]}>1 in 3</Text>
          <Text style={styles.statLabel}>older Americans{"\n"}feel lonely</Text>
        </View>
      </View>

      {/* How it works */}
      <Text style={styles.sectionTitle}>How it works</Text>
      <View style={styles.stepsCard}>
        {[
          { num: "1", text: "Senior requests a group outing" },
          { num: "2", text: "AI matches nearby seniors going to same destination" },
          { num: "3", text: "One volunteer driver serves the whole group" },
        ].map((step) => (
          <View key={step.num} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{step.num}</Text>
            </View>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}
      </View>

      {/* CTA Buttons */}
      <Text style={styles.sectionTitle}>Get started</Text>

      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/senior/register")}
      >
        <Text style={styles.ctaButtonText}>I'm a Senior</Text>
        <Text style={styles.ctaButtonSub}>Request a group outing</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: colors.secondary }]}
        onPress={() => router.push("/volunteer/register")}
      >
        <Text style={styles.ctaButtonText}>I'm a Volunteer</Text>
        <Text style={styles.ctaButtonSub}>Offer a ride, make a difference</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 26,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stepsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNum: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  ctaButton: {
    borderRadius: radius.pill,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  ctaButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ctaButtonSub: {
    fontSize: fontSize.xs,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
});
