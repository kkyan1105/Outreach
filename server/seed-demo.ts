/**
 * Demo Seed Script
 *
 * Sets up a specific scenario for the demo:
 *
 * Volunteer (David Chen, 6152000001):
 * - 1 confirmed park group (Carol + Edward → Centennial Park, Mon afternoon)
 * - 1 cancelled grocery group (was Alice + Bob, got cancelled)
 * - 0 available recommendations (no pending groups yet)
 * - Several scattered single requests on map/list (can't form groups)
 *
 * Demo flow:
 * 1. Show volunteer dashboard: 1 confirmed, 1 cancelled, no recommendations
 * 2. Show explore: scattered single requests on map
 * 3. Switch to elder (Alice, 6151000001): submit grocery request for Mon morning
 * 4. Auto-match kicks in: Alice + Dorothy + Helen → grocery group
 * 5. Switch back to volunteer: new group appears in "Available for you"
 * 6. Accept → View Route
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { hashPassword } from "./lib/auth";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedDemo() {
  const pw = await hashPassword("123456");

  console.log("Clearing all data...");
  await supabase.from("outings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("outing_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("volunteers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("seniors").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // ── Seniors ─────────────────────────────────────────────────────────────
  console.log("Inserting seniors...");
  const seniors = [
    // Alice — northernmost, will submit grocery request during demo
    { name: "Alice Johnson", phone: "6151000001", address: "1900 West End Ave, Nashville, TN", lat: 36.1525, lng: -86.7965, interests: ["grocery", "church"], emergency_contact_name: "John Johnson", emergency_contact_phone: "6155559001", password_hash: pw },
    // Bob — was in cancelled grocery group
    { name: "Bob Williams", phone: "6151000002", address: "1911 Broadway, Nashville, TN", lat: 36.1520, lng: -86.7960, interests: ["grocery", "pharmacy"], emergency_contact_name: "", emergency_contact_phone: "", password_hash: pw },
    // Dorothy — middle, on the way south
    { name: "Dorothy Smith", phone: "6151000003", address: "2100 21st Ave S, Nashville, TN", lat: 36.1430, lng: -86.7985, interests: ["grocery", "park"], emergency_contact_name: "Linda Smith", emergency_contact_phone: "6155559002", password_hash: pw },
    // Carol — in confirmed park group
    { name: "Carol Davis", phone: "6151000004", address: "1817 Division St, Nashville, TN", lat: 36.1530, lng: -86.7890, interests: ["park", "pharmacy"], emergency_contact_name: "Mike Davis", emergency_contact_phone: "6155559003", password_hash: pw },
    // Edward — in confirmed park group
    { name: "Edward Brown", phone: "6151000005", address: "1600 Division St, Nashville, TN", lat: 36.1535, lng: -86.7930, interests: ["park", "grocery"], emergency_contact_name: "", emergency_contact_phone: "", password_hash: pw },
    // Helen — southernmost, near the Kroger destination
    { name: "Helen Martinez", phone: "6151000008", address: "2500 21st Ave S, Nashville, TN", lat: 36.1340, lng: -86.7995, interests: ["grocery", "pharmacy"], emergency_contact_name: "Rosa Martinez", emergency_contact_phone: "6155559005", password_hash: pw },
    // Scattered singles — each has a unique request that can't form a group
    { name: "Faye Thompson", phone: "6151000006", address: "1808 21st Ave S, Nashville, TN", lat: 36.1380, lng: -86.7980, interests: ["church", "pharmacy"], emergency_contact_name: "Nancy Thompson", emergency_contact_phone: "6155559004", password_hash: pw },
    { name: "George Wilson", phone: "6151000007", address: "2000 Belcourt Ave, Nashville, TN", lat: 36.1365, lng: -86.7965, interests: ["church", "park"], emergency_contact_name: "", emergency_contact_phone: "", password_hash: pw },
    { name: "Irene Clark", phone: "6151000009", address: "1900 Belcourt Ave, Nashville, TN", lat: 36.1375, lng: -86.7955, interests: ["church", "park"], emergency_contact_name: "", emergency_contact_phone: "", password_hash: pw },
    { name: "James Lee", phone: "6151000010", address: "2500 21st Ave S, Nashville, TN", lat: 36.1340, lng: -86.7990, interests: ["grocery", "park"], emergency_contact_name: "", emergency_contact_phone: "", password_hash: pw },
  ];

  const { data: insertedSeniors, error: sErr } = await supabase.from("seniors").insert(seniors).select();
  if (sErr) { console.error("Senior insert error:", sErr); return; }
  const s = insertedSeniors!;
  console.log(`  Inserted ${s.length} seniors`);

  // ── Volunteers ──────────────────────────────────────────────────────────
  console.log("Inserting volunteers...");
  const volunteers = [
    { name: "David Chen", phone: "6152000001", address: "2424 21st Ave S, Nashville, TN", lat: 36.1355, lng: -86.7990, vehicle_type: "suv", max_passengers: 4, availability: ["monday_morning", "monday_afternoon", "wednesday_morning", "saturday_morning"], password_hash: pw },
    { name: "Sarah Kim", phone: "6152000002", address: "2100 21st Ave S, Nashville, TN", lat: 36.1350, lng: -86.7970, vehicle_type: "minivan", max_passengers: 6, availability: ["tuesday_morning", "thursday_morning", "saturday_afternoon"], password_hash: pw },
  ];

  const { data: insertedVolunteers, error: vErr } = await supabase.from("volunteers").insert(volunteers).select();
  if (vErr) { console.error("Volunteer insert error:", vErr); return; }
  const v = insertedVolunteers!;
  console.log(`  Inserted ${v.length} volunteers`);

  // ── Requests ────────────────────────────────────────────────────────────
  console.log("Inserting requests...");

  const requests = [
    // Park group (will be confirmed) — Carol + Edward, Mon afternoon
    { senior_id: s[3].id, destination_type: "park", destination_name: "Centennial Park", preferred_date: "2026-03-30", preferred_time_start: "13:00", preferred_time_end: "16:00", status: "matched" },
    { senior_id: s[4].id, destination_type: "park", destination_name: "Centennial Park", preferred_date: "2026-03-30", preferred_time_start: "14:00", preferred_time_end: "17:00", status: "matched" },

    // Cancelled grocery group — Bob (was matched, now cancelled back to pending... but we'll mark the outing as cancelled)
    { senior_id: s[1].id, destination_type: "grocery", destination_name: "Kroger on 21st Ave", preferred_date: "2026-03-30", preferred_time_start: "09:00", preferred_time_end: "12:00", status: "matched" },

    // Dorothy — pending grocery request, morning window slightly later
    { senior_id: s[2].id, destination_type: "grocery", destination_name: "Any", preferred_date: "2026-03-30", preferred_time_start: "09:30", preferred_time_end: "12:30", status: "pending" },

    // Helen — pending grocery request, starts later but overlaps
    { senior_id: s[5].id, destination_type: "grocery", destination_name: "Any", preferred_date: "2026-03-30", preferred_time_start: "10:00", preferred_time_end: "13:00", status: "pending" },

    // Scattered singles — all different types/dates, can't form groups
    { senior_id: s[6].id, destination_type: "church", destination_name: "West End Community Church", preferred_date: "2026-03-31", preferred_time_start: "09:00", preferred_time_end: "11:00", status: "pending" },
    { senior_id: s[7].id, destination_type: "pharmacy", destination_name: "CVS Pharmacy", preferred_date: "2026-04-01", preferred_time_start: "10:00", preferred_time_end: "14:00", status: "pending" },
    { senior_id: s[8].id, destination_type: "park", destination_name: "Shelby Bottoms", preferred_date: "2026-04-02", preferred_time_start: "14:00", preferred_time_end: "17:00", status: "pending" },
    { senior_id: s[9].id, destination_type: "grocery", destination_name: "Whole Foods", preferred_date: "2026-04-03", preferred_time_start: "09:00", preferred_time_end: "12:00", status: "pending" },
  ];

  const { data: insertedRequests, error: rErr } = await supabase.from("outing_requests").insert(requests).select();
  if (rErr) { console.error("Request insert error:", rErr); return; }
  const r = insertedRequests!;
  console.log(`  Inserted ${r.length} requests`);

  // ── Outings ─────────────────────────────────────────────────────────────
  console.log("Creating outings...");

  // 1. Confirmed park group — David Chen
  const { error: parkErr } = await supabase.from("outings").insert({
    volunteer_id: v[0].id,
    request_ids: [r[0].id, r[1].id],
    scheduled_date: "2026-03-30",
    scheduled_time: "14:00",
    destination_type: "park",
    route_info: { suggested_destination: "Centennial Park", reasoning: "2 seniors grouped for park outing" },
    status: "confirmed",
  });
  if (parkErr) console.error("Park outing error:", parkErr);
  else console.log("  ✅ Confirmed park group (Carol + Edward → David Chen)");

  // 2. Cancelled grocery group — was David Chen + Bob
  const { error: cancelErr } = await supabase.from("outings").insert({
    volunteer_id: v[0].id,
    request_ids: [r[2].id],
    scheduled_date: "2026-03-30",
    scheduled_time: "09:00",
    destination_type: "grocery",
    route_info: { suggested_destination: "Kroger on 21st Ave", reasoning: "Cancelled by volunteer" },
    status: "cancelled",
  });
  if (cancelErr) console.error("Cancelled outing error:", cancelErr);
  else console.log("  ✅ Cancelled grocery group (Bob)");

  console.log("\n" + "=".repeat(60));
  console.log("🎬 DEMO SEED COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📱 Volunteer login: 6152000001 / 123456 (David Chen)");
  console.log("   → Dashboard: 1 confirmed park, 1 cancelled grocery");
  console.log("   → Explore: 4 scattered single requests on map");
  console.log("   → No available groups yet");
  console.log("\n👴 Elder login: 6151000001 / 123456 (Alice Johnson)");
  console.log("   → Submit: Grocery, Mon 3/30, Morning, Any or Kroger");
  console.log("   → Auto-match: Alice + Dorothy + Helen → grocery group");
  console.log("   → Volunteer dashboard: new group appears!");
  console.log("\n📋 All accounts password: 123456");
  console.log("=".repeat(60));
}

seedDemo().catch(console.error);
