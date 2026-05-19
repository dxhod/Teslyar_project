import fs from "node:fs";
import path from "node:path";
import type { DashboardData } from "./types";

const DASHBOARD_JSON = path.join(process.cwd(), "public", "data", "dashboard.json");

export function getDashboardData(): DashboardData {
  if (!fs.existsSync(DASHBOARD_JSON)) {
    throw new Error("Missing public/data/dashboard.json. Run scripts/prepare_data.py first.");
  }

  return JSON.parse(fs.readFileSync(DASHBOARD_JSON, "utf8")) as DashboardData;
}
