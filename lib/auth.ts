import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AuthUser {
  id: string;
  role: "senior" | "volunteer";
  name: string;
  phone: string;
}

const AUTH_KEY = "auth_user";

export async function saveAuth(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export async function getAuth(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_KEY);
}
