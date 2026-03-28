import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

// GET /api/stats — Dashboard stats for coordinator view
router.get("/", async (_req, res) => {
  const [
    { count: seniorCount },
    { count: volunteerCount },
    { count: pendingRequests },
    { count: matchedRequests },
    { count: pendingOutings },
    { count: confirmedOutings },
    { count: completedOutings },
  ] = await Promise.all([
    supabase.from("seniors").select("*", { count: "exact", head: true }),
    supabase.from("volunteers").select("*", { count: "exact", head: true }),
    supabase.from("outing_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("outing_requests").select("*", { count: "exact", head: true }).eq("status", "matched"),
    supabase.from("outings").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("outings").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("outings").select("*", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  res.json({
    data: {
      seniors: seniorCount || 0,
      volunteers: volunteerCount || 0,
      requests: {
        pending: pendingRequests || 0,
        matched: matchedRequests || 0,
      },
      outings: {
        pending: pendingOutings || 0,
        confirmed: confirmedOutings || 0,
        completed: completedOutings || 0,
      },
    },
    error: null,
  });
});

export default router;
