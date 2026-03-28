// TODO: Person A — Landing / Home screen
import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Senior Outing App</Text>
      <Text style={{ marginTop: 8, color: "#666" }}>AI-powered group social outings for seniors</Text>
    </View>
  );
}
