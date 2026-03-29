import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../lib/theme";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function SeniorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 90,
          paddingBottom: 16,
          paddingTop: 10,
          justifyContent: "center",
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 20, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tabs.Screen name="status" options={{ title: "My Outings", tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }} />
      <Tabs.Screen name="request" options={{ href: null }} />
      <Tabs.Screen name="voice" options={{ href: null }} />
      <Tabs.Screen name="groups" options={{ href: null }} />
    </Tabs>
  );
}
