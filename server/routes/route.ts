import { Router } from "express";
import { planRoute } from "../lib/route-planner";

const router = Router();

// GET /api/route/:outingId
router.get("/:outingId", async (req, res) => {
  try {
    const plan = await planRoute(req.params.outingId);
    res.json({ data: plan, error: null });
  } catch (e) {
    res.status(500).json({ data: null, error: (e as Error).message });
  }
});

export default router;
