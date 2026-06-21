// ─────────────────────────────────────────────────────────
// EndGit API Server — endgit-core
// CI/CD + Plugin Marketplace for Endstone
// ─────────────────────────────────────────────────────────

import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import zlib from "zlib";
import { publicRateLimit } from "./middleware/rateLimit";
import { apolloServer } from "./graphql";
import { optionalAuth, AuthRequest } from "./middleware/auth";
import DataLoader from "dataloader";
import { prisma } from "@endgit/database";
import { expressMiddleware } from "@as-integrations/express4";
import { pluginsRouter } from "./modules/plugins/plugins.routes";
import { versionsRouter } from "./modules/versions/versions.routes";
import { downloadRouter } from "./modules/download/download.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { reviewRouter } from "./modules/reviews/reviews.routes";
import { moderationRouter } from "./modules/moderation/moderation.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { buildRouter } from "./modules/builds/builds.routes";
import { githubRouter } from "./modules/github/github.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { ratingRouter } from "./modules/ratings/ratings.routes";
import { commentsRouter } from "./modules/comments/comments.routes";
import { submitRouter } from "./modules/submit/submit.routes";
import { webhookRouter } from "./modules/webhooks/webhooks.routes";
import { callbackRouter } from "./modules/callback/callback.routes";

const app: express.Express = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || process.env.API_PORT || 4000;

// ── Middleware ────────────────────────────────────────────

app.use(
  compression({
    level: zlib.constants.Z_DEFAULT_COMPRESSION,
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req: express.Request, res: express.Response) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
    brotli: {
      enabled: true,
      zlib: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      },
    },
  } as any),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
  app.use(publicRateLimit);
}
app.use(
  cors({
    origin: [
      process.env.NEXTAUTH_URL || "http://localhost:3000",
      "http://localhost:4000", // Always allow localhost for local development
    ],
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(
  express.json({
    limit: "1mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// ── Health Check ─────────────────────────────────────────

app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Routes ───────────────────────────────────────────────

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/plugins", pluginsRouter);
app.use("/api/v1/versions", versionsRouter);
app.use("/api/v1/download", downloadRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/moderation", moderationRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/builds", buildRouter);
app.use("/api/v1/github", githubRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/ratings", ratingRouter);
app.use("/api/v1/comments", commentsRouter);
app.use("/api/v1/submit", submitRouter);
app.use("/api/v1/webhooks", webhookRouter);
app.use("/api/v1/builds", callbackRouter); // GitHub Actions artifact callbacks

// ── Start ────────────────────────────────────────────────

import { recalculateAllHeatScores } from "./modules/comments/comments.service";

const createUserLoader = () =>
  new DataLoader(async (userIds: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds as string[] } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return userIds.map((id) => userMap.get(id) || null);
  });

const createVersionLoader = () =>
  new DataLoader(async (pluginIds: readonly string[]) => {
    const versions = await prisma.version.findMany({
      where: { pluginId: { in: pluginIds as string[] } },
      orderBy: { createdAt: "desc" },
    });
    const map = new Map<string, any[]>();
    versions.forEach((v) => {
      if (!map.has(v.pluginId)) map.set(v.pluginId, []);
      map.get(v.pluginId)!.push({
        ...v,
        virustotal: {
          scanId: v.vtScanId,
          status: v.vtStatus,
          malicious: v.vtMalicious,
          suspicious: v.vtSuspicious,
          undetected: v.vtUndetected,
          total: v.vtTotal,
          permalink: v.vtPermalink,
          scanDate: v.vtScanDate,
        },
      });
    });
    return pluginIds.map((id) => map.get(id) || []);
  });

async function startServer() {
  await apolloServer.start();
  app.use(
    "/api/graphql",
    optionalAuth,
    expressMiddleware(apolloServer, {
      context: async ({ req }: { req: any }) => {
        return {
          user: (req as AuthRequest).user,
          loaders: {
            userLoader: createUserLoader(),
            versionLoader: createVersionLoader(),
          },
        };
      },
    }),
  );

  // ── Error Handler ────────────────────────────────────────
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("Error:", err.message);
      res.status(err.status || 500).json({
        success: false,
        error: err.message || "Internal Server Error",
      });
    },
  );

  // ── 404 Handler ──────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: "Not Found",
    });
  });

  app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║   EndGit API Server                               ║
    ║   Running on http://localhost:${PORT}             ║
    ║   GraphQL on http://localhost:${PORT}/api/graphql ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
    `);

    recalculateAllHeatScores().catch(() => {});
    setInterval(
      () => recalculateAllHeatScores().catch(() => {}),
      60 * 60 * 1000,
    );
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
