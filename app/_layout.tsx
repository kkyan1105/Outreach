// Root layout — Tab navigation
import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="senior" options={{ title: "Senior" }} />
      <Tabs.Screen name="volunteer" options={{ title: "Volunteer" }} />
      <Tabs.Screen name="match" options={{ title: "Outings" }} />
    </Tabs>
  );
}
