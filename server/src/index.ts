import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import matchupRouter from "./routes/matchup.js";
import { getPatches } from "./api/ugg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/patches", async (_req, res) => {
  try {
    const patches = await getPatches();
    res.json(patches);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.use("/api/matchup", matchupRouter);

// In production, serve the built React frontend
const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit(0);
});
