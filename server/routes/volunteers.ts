import { Router } from "express";
import { supabase } from "../lib/supabase";
import { geocodeAddress } from "../lib/geocode";

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
