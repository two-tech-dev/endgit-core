import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { dashboardService } from "./dashboard.service";

const statusCache = new Map<string, { data: any; expiresAt: number }>();
const STATUS_CACHE_TTL_MS = 30_000;

export class DashboardController {
  async getStatus(req: AuthRequest, res: Response) {
    try {
      const cacheKey = req.user!.id;
      const cached = statusCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.set("Cache-Control", "private, max-age=30");
        return res.json(cached.data);
      }

      const data = await dashboardService.getStatus(req.user!.id);
      const payload = { success: true, data };
      statusCache.set(cacheKey, { data: payload, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });

      res.set("Cache-Control", "private, max-age=30");
      res.json(payload);
    } catch (error: any) {
      console.error("Status check error:", error);
      res.status(500).json({ success: false, error: "Failed to check status" });
    }
  }

  async getPlugins(req: AuthRequest, res: Response) {
    try {
      const data = await dashboardService.getMyPlugins(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: "Failed to get plugins" });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      const data = await dashboardService.getMyStats(req.user!.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: "Failed to get stats" });
    }
  }
}

export const dashboardController = new DashboardController();
