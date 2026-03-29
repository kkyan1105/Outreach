import { Router } from "express";
import { supabase } from "../lib/supabase";
import { hashPassword, verifyPassword } from "../lib/auth";
import { geocodeAddress } from "../lib/geocode";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const {
    role, phone, password, name, address,
    interests, mobility_notes, emergency_contact,
    vehicle_type, max_passengers, availability,
  } = req.body;

  if (!role || !phone || !password || !name || !address) {
    return res.status(400).json({ data: null, error: "role, phone, password, name, and address are required" });
  }

  if (!["senior", "volunteer"].includes(role)) {
    return res.status(400).json({ data: null, error: "role must be 'senior' or 'volunteer'" });
  }

  const table = role === "senior" ? "seniors" : "volunteers";

  // Check if phone already exists
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("phone", phone)
    .single();

  if (existing) {
    return res.status(400).json({ data: null, error: "Phone number already registered" });
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
    phone,
    address,
    lat,
    lng,
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
    .select("id, name, phone")
    .single();

  if (error) {
    return res.status(500).json({ data: null, error: error.message });
  }

  res.json({
    data: { id: data.id, role, name: data.name, phone: data.phone },
    error: null,
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { role, phone, password } = req.body;

  if (!role || !phone || !password) {
    return res.status(400).json({ data: null, error: "role, phone, and password are required" });
  }

  if (!["senior", "volunteer"].includes(role)) {
    return res.status(400).json({ data: null, error: "role must be 'senior' or 'volunteer'" });
  }

  const table = role === "senior" ? "seniors" : "volunteers";

  const { data: user, error } = await supabase
    .from(table)
    .select("id, name, phone, password_hash")
    .eq("phone", phone)
    .single();

  if (error || !user) {
    return res.status(401).json({ data: null, error: "Invalid phone number or password" });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ data: null, error: "Invalid phone number or password" });
  }

  res.json({
    data: { id: user.id, role, name: user.name, phone: user.phone },
    error: null,
  });
});

// POST /api/auth/change-password
router.post("/change-password", async (req, res) => {
  const { role, id, current_password, new_password } = req.body;

  if (!role || !id || !current_password || !new_password) {
    return res.status(400).json({ data: null, error: "role, id, current_password, and new_password are required" });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ data: null, error: "New password must be at least 6 characters" });
  }

  const table = role === "senior" ? "seniors" : "volunteers";

  const { data: user, error } = await supabase
    .from(table)
    .select("id, password_hash")
    .eq("id", id)
    .single();

  if (error || !user) {
    return res.status(404).json({ data: null, error: "User not found" });
  }

  const valid = await verifyPassword(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ data: null, error: "Current password is incorrect" });
  }

  const newHash = await hashPassword(new_password);
  await supabase.from(table).update({ password_hash: newHash }).eq("id", id);

  res.json({ data: { success: true }, error: null });
});

export default router;
