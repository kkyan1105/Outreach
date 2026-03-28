import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { getAuth, AuthUser } from "../lib/auth";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [ready, setReady] = useState(false);

  // Read auth on every navigation change
  useEffect(() => {
    getAuth().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, [segments]);

  useEffect(() => {
    if (!ready) return;

    const inSenior = segments[0] === "(senior)";
    const inVolunteer = segments[0] === "(volunteer)";

    if (!user) {
      // Not logged in — only allow landing and auth pages
      if (inSenior || inVolunteer) {
        router.replace("/");
      }
    } else if (user.role === "senior") {
      if (!inSenior) router.replace("/(senior)/home");
    } else if (user.role === "volunteer") {
      if (!inVolunteer) router.replace("/(volunteer)/dashboard");
    }
  }, [user, ready]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(senior)" />
      <Stack.Screen name="(volunteer)" />
    </Stack>
  );
}
