import express from "express";
import cors from "cors";
import matchupRouter from "./routes/matchup.js";
import { closeBrowser } from "./scraper/browser.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/matchup", matchupRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function shutdown() {
  console.log("Shutting down...");
  await closeBrowser();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
