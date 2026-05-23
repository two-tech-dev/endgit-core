import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { githubService } from "./github.service";
import { cacheGet, cacheSet } from "../../lib/cache";

const REPOS_CACHE_TTL = 30;

export class GithubController {
  async getOrgs(req: AuthRequest, res: Response) {
    try {
      const orgs = await githubService.getUserOrgs(req.user!.id);
      res.json({ success: true, data: orgs });
    } catch (error: any) {
      console.error("GitHub orgs error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch organizations",
      });
    }
  }

  async getRepos(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.per_page as string) || 30;
      const org = req.query.org as string | undefined;
      const search = (req.query.search as string) || undefined;

      const cacheKey = `gh:repos:${req.user!.id}:${page}:${perPage}:${org || ""}:${search || ""}`;
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        res.set("Cache-Control", "private, max-age=30");
        return res.json(cached);
      }

      const { repos, hasMore, totalCount, totalEnabled, totalDisabled } =
        await githubService.getUserRepos(
          req.user!.id,
          page,
          perPage,
          org,
          search,
        );

      const payload = {
        success: true,
        data: repos,
        pagination: {
          hasMore,
          page,
          perPage,
          totalCount,
          totalEnabled,
          totalDisabled,
        },
      };
      await cacheSet(cacheKey, payload, REPOS_CACHE_TTL);

      res.set("Cache-Control", "private, max-age=30");
      res.json(payload);
    } catch (error: any) {
      console.error("GitHub repos error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch repositories",
      });
    }
  }

  async enableCI(req: AuthRequest, res: Response) {
    try {
      const plugin = await githubService.enableCI(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        data: plugin,
        webhook: plugin.webhookId ? "installed" : "failed",
      });
    } catch (error: any) {
      console.error("Enable CI error:", error);
      res.status(error.message.includes("not found") ? 404 : 400).json({
        success: false,
        error: error.message || "Failed to enable CI",
      });
    }
  }

  async disableCI(req: AuthRequest, res: Response) {
    try {
      await githubService.disableCI(req.user!.id, String(req.params.pluginId));
      res.json({ success: true, message: "CI disabled and webhook removed" });
    } catch (error: any) {
      console.error("Disable CI error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to disable CI",
      });
    }
  }

  async getRepoReadme(req: AuthRequest, res: Response) {
    try {
      const { owner, repo } = req.query;
      if (!owner || !repo) {
        return res
          .status(400)
          .json({ success: false, error: "Missing owner or repo" });
      }

      const text = await githubService.getRepoReadme(
        req.user!.id,
        String(owner),
        String(repo),
      );
      res.json({ success: true, data: text });
    } catch (error: any) {
      console.error("Proxy README error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch README",
      });
    }
  }

  async getRepoLicense(req: AuthRequest, res: Response) {
    try {
      const { owner, repo } = req.query;
      if (!owner || !repo) {
        return res
          .status(400)
          .json({ success: false, error: "Missing owner or repo" });
      }

      const license = await githubService.getRepoLicense(
        req.user!.id,
        String(owner),
        String(repo),
      );
      res.json({ success: true, data: license });
    } catch (error: any) {
      console.error("Proxy license error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch license",
      });
    }
  }
}

export const githubController = new GithubController();
