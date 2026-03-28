import { Router } from "express";
import { supabase } from "../lib/supabase";
import { hashPassword, verifyPassword } from "../lib/auth";
import { geocodeAddress } from "../lib/geocode";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const {
    role, email, password, name, phone, address,
    interests, mobility_notes, emergency_contact,
    vehicle_type, max_passengers, availability,
  } = req.body;

  if (!role || !email || !password || !name || !address) {
    return res.status(400).json({ data: null, error: "role, email, password, name, and address are required" });
  }

  if (!["senior", "volunteer"].includes(role)) {
    return res.status(400).json({ data: null, error: "role must be 'senior' or 'volunteer'" });
  }

  const table = role === "senior" ? "seniors" : "volunteers";

  // Check if email already exists
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return res.status(400).json({ data: null, error: "Email already registered" });
  }

  // Geocode address
  let lat: number, lng: number;
  try {
    const geo = await geocodeAddress(address);
    lat = geo.lat;
    lng = geo.lng;
  } catch (e) {
    return res.status(400).json({ data: null, error: `Geocoding failed: ${(e as Error).message}` });
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Build insert object
  let insertData: any = {
    name,
    phone: phone || "",
    address,
    lat,
    lng,
    email,
    password_hash,
  };

  if (role === "senior") {
    insertData.interests = interests || [];
    insertData.mobility_notes = mobility_notes || "";
    insertData.emergency_contact = emergency_contact || "";
  } else {
    insertData.vehicle_type = vehicle_type || "sedan";
    insertData.max_passengers = max_passengers || 4;
    insertData.availability = availability || [];
  }

  const { data, error } = await supabase
    .from(table)
    .insert(insertData)
    .select("id, name, email")
    .single();

  if (error) {
    return res.status(500).json({ data: null, error: error.message });
  }

  res.json({
    data: { id: data.id, role, name: data.name, email: data.email },
    error: null,
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { role, email, password } = req.body;

  if (!role || !email || !password) {
    return res.status(400).json({ data: null, error: "role, email, and password are required" });
  }

  if (!["senior", "volunteer"].includes(role)) {
    return res.status(400).json({ data: null, error: "role must be 'senior' or 'volunteer'" });
  }

  const table = role === "senior" ? "seniors" : "volunteers";

  const { data: user, error } = await supabase
    .from(table)
    .select("id, name, email, password_hash")
    .eq("email", email)
    .single();

  if (error || !user) {
    return res.status(401).json({ data: null, error: "Invalid email or password" });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ data: null, error: "Invalid email or password" });
  }

  res.json({
    data: { id: user.id, role, name: user.name, email: user.email },
    error: null,
  });
});

export default router;
