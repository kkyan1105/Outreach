import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

// GET /api/requests
router.get("/", async (req, res) => {
  const { status, senior_id } = req.query;

  let query = supabase
    .from("outing_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as string);
  if (senior_id) query = query.eq("senior_id", senior_id as string);

  const { data, error } = await query;

  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
});

// POST /api/requests
router.post("/", async (req, res) => {
  const { senior_id, destination_type, destination_name, preferred_date, preferred_time_start, preferred_time_end } = req.body;

  if (!senior_id || !destination_type || !preferred_date) {
    return res.status(400).json({ data: null, error: "senior_id, destination_type, and preferred_date are required" });
  }

  const { data, error } = await supabase
    .from("outing_requests")
    .insert({
      senior_id,
      destination_type,
      destination_name: destination_name || "",
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      status: "pending",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
});

export default router;
