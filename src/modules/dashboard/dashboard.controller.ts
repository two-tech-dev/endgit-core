import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { dashboardService } from "./dashboard.service";
import { cacheGet, cacheSet } from "../../lib/cache";

const STATUS_CACHE_TTL = 30;

export class DashboardController {
  async getStatus(req: AuthRequest, res: Response) {
    try {
      const cacheKey = `dashboard:status:${req.user!.id}`;
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        res.set("Cache-Control", "private, max-age=30");
        return res.json(cached);
      }

      const data = await dashboardService.getStatus(req.user!.id);
      const payload = { success: true, data };
      await cacheSet(cacheKey, payload, STATUS_CACHE_TTL);

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
