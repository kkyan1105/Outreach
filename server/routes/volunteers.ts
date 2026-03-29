import { Router } from "express";
import { supabase } from "../lib/supabase";
import { geocodeAddress } from "../lib/geocode";
import { triggerAutoMatch } from "../lib/auto-match";

const router = Router();

// GET /api/volunteers
router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
});

// GET /api/volunteers/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ data: null, error: "Volunteer not found" });

  const { password_hash, ...safe } = data as any;
  res.json({ data: safe, error: null });
});

// PATCH /api/volunteers/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, vehicle_type, max_passengers, availability } = req.body;

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (vehicle_type !== undefined) updates.vehicle_type = vehicle_type;
  if (max_passengers !== undefined) updates.max_passengers = max_passengers;
  if (availability !== undefined) updates.availability = availability;

  // If address changed, re-geocode
  if (address !== undefined) {
    updates.address = address;
    try {
      const geo = await geocodeAddress(address);
      updates.lat = geo.lat;
      updates.lng = geo.lng;
    } catch (e) {
      return res.status(400).json({ data: null, error: `Geocoding failed: ${(e as Error).message}` });
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ data: null, error: "No valid fields to update" });
  }

  const { data, error } = await supabase
    .from("volunteers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });

  const { password_hash, ...safe } = data as any;

  // When availability changes, cancel pending outings that no longer fit
  if (availability !== undefined) {
    // Get all pending outings for this volunteer
    const { data: pendingOutings } = await supabase
      .from("outings")
      .select("*")
      .eq("volunteer_id", id)
      .eq("status", "pending");

    if (pendingOutings && pendingOutings.length > 0) {
      const newAvail = new Set(availability as string[]);

      for (const outing of pendingOutings) {
        // Check if the outing's day/time still fits the new availability
        const outingDate = new Date(outing.scheduled_date + "T00:00:00");
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayName = dayNames[outingDate.getDay()];

        const [h] = (outing.scheduled_time || "00:00").split(":").map(Number);
        let timeSlot = "morning";
        if (h >= 8 && h < 11) timeSlot = "morning";
        else if (h >= 11 && h < 14) timeSlot = "midday";
        else if (h >= 14 && h < 17) timeSlot = "afternoon";
        else if (h >= 17) timeSlot = "evening";

        const slotKey = `${dayName}_${timeSlot}`;

        // Check all possible slot keys for this day (in case time mapping is loose)
        const daySlots = ["morning", "midday", "afternoon", "evening"].map(s => `${dayName}_${s}`);
        const hasAnySlotForDay = daySlots.some(s => newAvail.has(s));

        if (!hasAnySlotForDay) {
          // Cancel this outing — volunteer no longer available that day
          await supabase
            .from("outings")
            .update({ status: "cancelled" })
            .eq("id", outing.id);

          // Reset associated requests back to pending
          if (outing.request_ids && outing.request_ids.length > 0) {
            await supabase
              .from("outing_requests")
              .update({ status: "pending" })
              .in("id", outing.request_ids);
          }

          console.log(`[volunteers] Cancelled outing ${outing.id} — volunteer no longer available on ${dayName}`);
        }
      }
    }

    // Re-run matching with updated availability
    triggerAutoMatch().catch((e) =>
      console.error("[volunteers] Auto-match failed:", (e as Error).message)
    );
  }

  res.json({ data: safe, error: null });
});

// POST /api/volunteers
router.post("/", async (req, res) => {
  const { name, phone, address, vehicle_type, max_passengers, availability } = req.body;

  if (!name || !address) {
    return res.status(400).json({ data: null, error: "Name and address are required" });
  }

  let lat: number, lng: number;
  try {
    const geo = await geocodeAddress(address);
    lat = geo.lat;
    lng = geo.lng;
  } catch (e) {
    return res.status(400).json({ data: null, error: `Geocoding failed: ${(e as Error).message}` });
  }

  const { data, error } = await supabase
    .from("volunteers")
    .insert({
      name,
      phone: phone || "",
      address,
      lat,
      lng,
      vehicle_type: vehicle_type || "sedan",
      max_passengers: max_passengers || 4,
      availability: availability || [],
    })
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
});

export default router;
