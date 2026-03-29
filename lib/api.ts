// Helper to call backend server API
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3001";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Server returned ${res.status} (non-JSON). Is the server running?`);
  }
  return res.json();
}
