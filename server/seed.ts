import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { hashPassword } from "./lib/auth";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All locations are around Vanderbilt University, Nashville, TN
const seniors = [
  // Cluster 1: West End / Vanderbilt area — all want grocery on same day
  { name: "Alice Johnson", phone: "6151000001", address: "2301 Vanderbilt Pl, Nashville, TN", lat: 36.1447, lng: -86.8027, interests: ["grocery", "church"], mobility_notes: "Uses a walker", emergency_contact: "Son: 6155559001" },
  { name: "Bob Williams", phone: "6151000002", address: "1911 Broadway, Nashville, TN", lat: 36.1520, lng: -86.7960, interests: ["grocery", "library"], mobility_notes: "", emergency_contact: "" },
  { name: "Dorothy Smith", phone: "6151000003", address: "2100 West End Ave, Nashville, TN", lat: 36.1490, lng: -86.8010, interests: ["grocery", "restaurant"], mobility_notes: "", emergency_contact: "Daughter: 6155559002" },

  // Cluster 2: Midtown / Music Row — want park on same day
  { name: "Carol Davis", phone: "6151000004", address: "1817 Division St, Nashville, TN", lat: 36.1530, lng: -86.7890, interests: ["park", "museum"], mobility_notes: "Wheelchair accessible vehicle needed", emergency_contact: "Son: 6155559003" },
  { name: "Edward Brown", phone: "6151000005", address: "1600 Division St, Nashville, TN", lat: 36.1535, lng: -86.7930, interests: ["park", "library"], mobility_notes: "Needs front seat", emergency_contact: "" },

  // Cluster 3: Hillsboro Village — want church on same day
  { name: "Faye Thompson", phone: "6151000006", address: "1808 21st Ave S, Nashville, TN", lat: 36.1380, lng: -86.7980, interests: ["church", "restaurant"], mobility_notes: "", emergency_contact: "Niece: 6155559004" },
  { name: "George Wilson", phone: "6151000007", address: "2000 Belcourt Ave, Nashville, TN", lat: 36.1365, lng: -86.7965, interests: ["church", "museum"], mobility_notes: "", emergency_contact: "" },

  // Standalone — library request, different date
  { name: "Helen Martinez", phone: "6151000008", address: "401 21st Ave S, Nashville, TN", lat: 36.1480, lng: -86.7990, interests: ["library"], mobility_notes: "Hard of hearing", emergency_contact: "Grandson: 6155559005" },
];

const volunteers = [
  // Near Vanderbilt — can serve Cluster 1 & 2
  { name: "David Chen", phone: "6152000001", address: "2400 West End Ave, Nashville, TN", lat: 36.1470, lng: -86.8050, vehicle_type: "suv", max_passengers: 4, availability: ["monday_morning", "wednesday_morning", "saturday_morning"] },
  // Near Hillsboro — can serve Cluster 3
  { name: "Sarah Kim", phone: "6152000002", address: "2100 21st Ave S, Nashville, TN", lat: 36.1350, lng: -86.7970, vehicle_type: "minivan", max_passengers: 6, availability: ["tuesday_morning", "thursday_morning", "saturday_afternoon"] },
  // Midtown — backup
  { name: "James Park", phone: "6152000003", address: "1700 Broadway, Nashville, TN", lat: 36.1555, lng: -86.7925, vehicle_type: "sedan", max_passengers: 3, availability: ["monday_afternoon", "wednesday_afternoon", "friday_morning"] },
];

// Requests designed to form AI-matchable groups:
// Group A: Alice + Bob + Dorothy → grocery, same day & overlapping time, near each other
// Group B: Carol + Edward → park, same day & overlapping time, near each other
// Group C: Faye + George → church, same day & overlapping time, near each other
// Standalone: Helen → library, different day

async function seed() {
  const pw = await hashPassword("123456");

  console.log("Clearing existing data...");
  await supabase.from("outings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("outing_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("volunteers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("seniors").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Inserting seniors...");
  const { data: insertedSeniors, error: sErr } = await supabase
    .from("seniors")
    .insert(seniors.map((s) => ({ ...s, password_hash: pw })))
    .select();
  if (sErr) { console.error("Senior insert error:", sErr); return; }
  console.log(`  Inserted ${insertedSeniors!.length} seniors`);

  console.log("Inserting volunteers...");
  const { data: insertedVolunteers, error: vErr } = await supabase
    .from("volunteers")
    .insert(volunteers.map((v) => ({ ...v, password_hash: pw })))
    .select();
  if (vErr) { console.error("Volunteer insert error:", vErr); return; }
  console.log(`  Inserted ${insertedVolunteers!.length} volunteers`);

  const s = insertedSeniors!;

  const requests = [
    // Group A: Grocery — Monday morning, overlapping windows
    { senior_id: s[0].id, destination_type: "grocery", destination_name: "Kroger on 21st Ave", preferred_date: "2026-03-30", preferred_time_start: "09:00", preferred_time_end: "12:00" },
    { senior_id: s[1].id, destination_type: "grocery", destination_name: "Publix on Broadway", preferred_date: "2026-03-30", preferred_time_start: "10:00", preferred_time_end: "13:00" },
    { senior_id: s[2].id, destination_type: "grocery", destination_name: "Trader Joe's", preferred_date: "2026-03-30", preferred_time_start: "09:30", preferred_time_end: "11:30" },

    // Group B: Park — Monday afternoon, overlapping windows
    { senior_id: s[3].id, destination_type: "park", destination_name: "Centennial Park", preferred_date: "2026-03-30", preferred_time_start: "13:00", preferred_time_end: "16:00" },
    { senior_id: s[4].id, destination_type: "park", destination_name: "Centennial Park", preferred_date: "2026-03-30", preferred_time_start: "14:00", preferred_time_end: "17:00" },

    // Group C: Church — Tuesday morning, overlapping windows
    { senior_id: s[5].id, destination_type: "church", destination_name: "West End Community Church", preferred_date: "2026-03-31", preferred_time_start: "08:30", preferred_time_end: "11:00" },
    { senior_id: s[6].id, destination_type: "church", destination_name: "Belmont Church", preferred_date: "2026-03-31", preferred_time_start: "09:00", preferred_time_end: "11:30" },

    // Standalone: Library — Wednesday
    { senior_id: s[7].id, destination_type: "library", destination_name: "Nashville Public Library", preferred_date: "2026-04-01", preferred_time_start: "10:00", preferred_time_end: "14:00" },
  ];

  console.log("Inserting outing requests...");
  const { data: insertedRequests, error: rErr } = await supabase
    .from("outing_requests")
    .insert(requests)
    .select();
  if (rErr) { console.error("Request insert error:", rErr); return; }
  console.log(`  Inserted ${insertedRequests!.length} requests`);

  console.log("\n✅ Seed complete!");
  console.log(`  ${s.length} seniors (all password: 123456)`);
  console.log(`  ${insertedVolunteers!.length} volunteers (all password: 123456)`);
  console.log(`  ${insertedRequests!.length} outing requests (all pending)`);
  console.log("\nExpected AI matching groups:");
  console.log("  Group A: Alice + Bob + Dorothy → grocery (Mon morning) → David Chen");
  console.log("  Group B: Carol + Edward → park (Mon afternoon) → James Park");
  console.log("  Group C: Faye + George → church (Tue morning) → Sarah Kim");
  console.log("  Unmatched: Helen → library (Wed) — may match if volunteer available");
  console.log("\nTest logins:");
  console.log("  Senior:    phone 6151000001, password 123456");
  console.log("  Volunteer: phone 6152000001, password 123456");
}

seed().catch(console.error);
