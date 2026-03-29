import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import seniorsRouter from "./routes/seniors";
import volunteersRouter from "./routes/volunteers";
import requestsRouter from "./routes/requests";
import outingsRouter from "./routes/outings";
import statsRouter from "./routes/stats";
import authRouter from "./routes/auth";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/seniors", seniorsRouter);
app.use("/api/volunteers", volunteersRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/outings", outingsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/auth", authRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
