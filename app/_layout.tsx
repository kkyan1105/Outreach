import { Tabs } from "expo-router";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="senior" options={{ title: "Senior" }} />
      <Tabs.Screen name="volunteer" options={{ title: "Volunteer" }} />
      <Tabs.Screen name="match" options={{ title: "Outings" }} />
    </Tabs>
  );
}
