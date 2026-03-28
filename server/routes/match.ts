// TODO: Person B — Phase 3 核心，AI 匹配
// 现在先放一个 placeholder，Phase 3 再实现
import { Router } from "express";

const router = Router();

router.post("/", async (_req, res) => {
  res.json({ data: null, error: "AI matching not implemented yet — coming in Phase 3" });
});

export default router;
