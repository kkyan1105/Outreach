import { Router } from "express";
import { supabase } from "../lib/supabase";
import { geocodeAddress } from "../lib/geocode";

const router = Router();

// GET /api/seniors?id=xxx  or  GET /api/seniors (all)
router.get("/", async (req, res) => {
  const { id } = req.query;
  let query = supabase.from("seniors").select("*");
  if (id) query = query.eq("id", id);
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
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
