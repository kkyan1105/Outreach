import { Router } from "express";
import { supabase } from "../lib/supabase";
import { geocodeAddress } from "../lib/geocode";

const router = Router();

// GET /api/seniors
router.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("seniors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ data: null, error: error.message });
  // Only show first name in list for privacy
  const safe = (data || []).map((s: any) => {
    const { password_hash, emergency_contact, ...rest } = s;
    return { ...rest, name: s.name.split(" ")[0] };
  });
  res.json({ data: safe, error: null });
});

// GET /api/seniors/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("seniors")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ data: null, error: "Senior not found" });

  // Exclude password_hash from response
  const { password_hash, ...safe } = data as any;
  res.json({ data: safe, error: null });
});

// PATCH /api/seniors/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, interests, mobility_notes, emergency_contact } = req.body;

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (interests !== undefined) updates.interests = interests;
  if (mobility_notes !== undefined) updates.mobility_notes = mobility_notes;
  if (emergency_contact !== undefined) updates.emergency_contact = emergency_contact;

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
    .from("seniors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });

  const { password_hash, ...safe } = data as any;
  res.json({ data: safe, error: null });
});

// POST /api/seniors
router.post("/", async (req, res) => {
  const { name, phone, address, interests, mobility_notes, emergency_contact } = req.body;

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
    .from("seniors")
    .insert({
      name,
      phone: phone || "",
      address,
      lat,
      lng,
      interests: interests || [],
      mobility_notes: mobility_notes || "",
      emergency_contact: emergency_contact || "",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
});

export default router;
