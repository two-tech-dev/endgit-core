import { prisma, Prisma } from "@endgit/database";
import { createStorage } from "@endgit/storage";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import fs from "fs";
import path from "path";

const storage = createStorage();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const vtConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  family: 4,
  tls: REDIS_URL.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});
const vtQueue = new Queue("vt-scans", { connection: vtConnection });

const MAX_PROPRIETARY_PLUGINS = 10;

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,62}$/;
const ARTIFACT_KEY_REGEX =
  /^artifacts\/[a-z0-9][a-z0-9-]{0,62}\/[1-9][0-9]*\/[A-Za-z0-9_.-]+\.(whl|so|dll)$/;

const MAGIC_BYTES: Record<string, Buffer> = {
  ".whl": Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  ".so": Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  ".dll": Buffer.from([0x4d, 0x5a]),
};

const MIME_TYPES: Record<string, string> = {
  ".whl": "application/zip",
  ".so": "application/x-sharedlib",
  ".dll": "application/x-msdownload",
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, "");
}

function sanitizeFilename(originalName: string): string {
  return path.basename(originalName).replace(/[^A-Za-z0-9_.-]/g, "_");
}

function validateInputs(data: Record<string, any>): string | null {
  const {
    name,
    displayName,
    description,
    longDescription,
    pluginType,
    tags,
    keywords,
    iconUrl,
  } = data;

  if (!name || !NAME_REGEX.test(name)) {
    return "Invalid plugin name. Must be 1-63 lowercase alphanumeric characters or hyphens, starting with alphanumeric.";
  }
  if (!displayName || typeof displayName !== "string") {
    return "Display name is required.";
  }
  const cleanDisplayName = stripHtml(displayName).trim();
  if (cleanDisplayName.length === 0 || cleanDisplayName.length > 64) {
    return "Display name must be 1-64 characters.";
  }
  if (!description || typeof description !== "string") {
    return "Description is required.";
  }
  const cleanDescription = stripHtml(description).trim();
  if (cleanDescription.length === 0 || cleanDescription.length > 100) {
    return "Description must be 1-100 characters.";
  }
  if (
    longDescription &&
    typeof longDescription === "string" &&
    longDescription.length > 50_000
  ) {
    return "Long description must be at most 50,000 characters.";
  }
  if (!pluginType || !["PYTHON", "CPP"].includes(pluginType)) {
    return "Plugin type must be PYTHON or CPP.";
  }
  if (tags) {
    const tagList = typeof tags === "string" ? tags.split(",") : [];
    if (tagList.length > 5) return "Maximum 5 tags allowed.";
    for (const t of tagList) {
      if (t.trim().length > 32)
        return "Each tag must be at most 32 characters.";
    }
  }
  if (keywords) {
    const kwList = typeof keywords === "string" ? keywords.split(",") : [];
    if (kwList.length > 10) return "Maximum 10 keywords allowed.";
    for (const k of kwList) {
      if (k.trim().length > 32)
        return "Each keyword must be at most 32 characters.";
    }
  }
  if (iconUrl && typeof iconUrl === "string" && iconUrl.length > 0) {
    try {
      const u = new URL(iconUrl);
      if (u.protocol !== "https:") return "Icon URL must use HTTPS.";
    } catch {
      return "Invalid icon URL.";
    }
  }
  return null;
}

async function verifyMagicNumber(
  filePath: string,
  expectedExt: string,
): Promise<boolean> {
  const expected = MAGIC_BYTES[expectedExt];
  if (!expected) return false;
  const fh = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(expected.length);
    await fh.read(buf, 0, expected.length, 0);
    return buf.equals(expected);
  } finally {
    await fh.close();
  }
}

export class UploadService {
  async uploadPlugin(
    fields: Record<string, any>,
    files: Record<string, Express.Multer.File[]>,
    userId: string,
  ) {
    const allFiles: Express.Multer.File[] = [];

    try {
      const validationError = validateInputs(fields);
      if (validationError) throw new Error(validationError);

      const {
        name,
        displayName,
        description,
        longDescription,
        pluginType,
        tags,
        keywords,
        iconUrl,
      } = fields;

      const slug = name;

      const existingPlugin = await prisma.plugin.findFirst({
        where: { OR: [{ name }, { slug }] },
      });
      if (existingPlugin)
        throw new Error("A plugin with this name already exists.");

      const proprietaryCount = await prisma.plugin.count({
        where: { authorId: userId, isProprietary: true },
      });
      if (proprietaryCount >= MAX_PROPRIETARY_PLUGINS) {
        throw new Error(
          `You have reached the maximum of ${MAX_PROPRIETARY_PLUGINS} proprietary plugins.`,
        );
      }

      let artifactFiles: { file: Express.Multer.File; ext: string }[] = [];

      if (pluginType === "PYTHON") {
        const artifact = files["artifact"]?.[0];
        if (!artifact) throw new Error("A .whl artifact file is required.");
        allFiles.push(artifact);
        if (!artifact.originalname.endsWith(".whl")) {
          throw new Error("Python artifact must be a .whl file.");
        }
        const valid = await verifyMagicNumber(artifact.path, ".whl");
        if (!valid) throw new Error("File content does not match .whl format.");
        artifactFiles.push({ file: artifact, ext: ".whl" });
      } else if (pluginType === "CPP") {
        const linuxFile = files["artifact_linux"]?.[0];
        const winFile = files["artifact_win"]?.[0];
        if (!linuxFile)
          throw new Error("A Linux .so artifact file is required.");
        if (!winFile)
          throw new Error("A Windows .dll artifact file is required.");
        allFiles.push(linuxFile, winFile);

        if (!linuxFile.originalname.endsWith(".so")) {
          throw new Error("Linux artifact must be a .so file.");
        }
        if (!winFile.originalname.endsWith(".dll")) {
          throw new Error("Windows artifact must be a .dll file.");
        }
        const linuxValid = await verifyMagicNumber(linuxFile.path, ".so");
        if (!linuxValid)
          throw new Error("File content does not match .so format.");
        const winValid = await verifyMagicNumber(winFile.path, ".dll");
        if (!winValid)
          throw new Error("File content does not match .dll format.");

        artifactFiles.push(
          { file: linuxFile, ext: ".so" },
          { file: winFile, ext: ".dll" },
        );
      } else {
        throw new Error("Invalid plugin type.");
      }

      const processedTags =
        tags && typeof tags === "string"
          ? tags
              .split(",")
              .map((t: string) => stripHtml(t).trim())
              .filter(Boolean)
          : [];

      const processedKeywords =
        keywords && typeof keywords === "string"
          ? keywords
              .split(",")
              .map((k: string) => stripHtml(k).trim())
              .filter(Boolean)
          : [];

      const artifactKeys: string[] = [];
      const buildNumber = 1;

      let plugin: any;
      let build: any;

      try {
        plugin = await prisma.plugin.create({
          data: {
            name,
            slug,
            displayName: stripHtml(displayName).trim(),
            description: stripHtml(description).trim(),
            longDescription: longDescription || null,
            pluginType,
            repoUrl: null,
            license: "Proprietary",
            tags: processedTags,
            keywords: processedKeywords,
            iconUrl: iconUrl || null,
            authorId: userId,
            status: "DRAFT",
            isProprietary: true,
          },
        });

        for (const { file, ext } of artifactFiles) {
          const safeName = sanitizeFilename(file.originalname);
          const artifactKey = `artifacts/${slug}/${buildNumber}/${safeName}`;

          if (!ARTIFACT_KEY_REGEX.test(artifactKey)) {
            throw new Error("Generated storage key failed validation.");
          }

          const fileBuffer = await fs.promises.readFile(file.path);
          await storage.upload(artifactKey, fileBuffer, MIME_TYPES[ext]);
          artifactKeys.push(artifactKey);
        }

        const artifactUrl =
          pluginType === "PYTHON"
            ? `/api/v1/download/file/${encodeURIComponent(artifactKeys[0])}`
            : undefined;

        const artifactSize =
          pluginType === "PYTHON" ? artifactFiles[0].file.size : undefined;

        const artifactUrlLinux =
          pluginType === "CPP"
            ? `/api/v1/download/file/${encodeURIComponent(
                artifactKeys.find((k) => k.endsWith(".so"))!,
              )}`
            : undefined;
        const artifactSizeLinux =
          pluginType === "CPP"
            ? artifactFiles.find((f) => f.ext === ".so")!.file.size
            : undefined;
        const artifactUrlWin =
          pluginType === "CPP"
            ? `/api/v1/download/file/${encodeURIComponent(
                artifactKeys.find((k) => k.endsWith(".dll"))!,
              )}`
            : undefined;
        const artifactSizeWin =
          pluginType === "CPP"
            ? artifactFiles.find((f) => f.ext === ".dll")!.file.size
            : undefined;

        build = await prisma.build.create({
          data: {
            pluginId: plugin.id,
            buildNumber,
            status: "SUCCESS",
            triggerType: "UPLOAD",
            branch: "main",
            artifactUrl,
            artifactSize,
            artifactUrlLinux,
            artifactSizeLinux,
            artifactUrlWin,
            artifactSizeWin,
            finishedAt: new Date(),
          },
        });

        await vtQueue
          .add("scan", {
            versionId: plugin.id,
            pluginSlug: slug,
            artifactKeys,
          })
          .catch((e) =>
            console.error("[VT] Failed to enqueue scan:", e.message),
          );

        return { plugin, build };
      } catch (err) {
        if (build) {
          await prisma.build
            .delete({ where: { id: build.id } })
            .catch(() => {});
        }
        if (plugin) {
          await prisma.plugin
            .delete({ where: { id: plugin.id } })
            .catch(() => {});
        }
        for (const key of artifactKeys) {
          await storage.delete(key).catch(() => {});
        }
        throw err;
      }
    } finally {
      for (const file of allFiles) {
        try {
          await fs.promises.unlink(file.path);
        } catch {}
      }
    }
  }

  async uploadNewVersion(
    slug: string,
    files: Record<string, Express.Multer.File[]>,
    userId: string,
  ) {
    const allFiles: Express.Multer.File[] = [];

    try {
      const plugin = await prisma.plugin.findUnique({ where: { slug } });
      if (!plugin) throw new Error("Plugin not found.");
      if (plugin.authorId !== userId) throw new Error("Not authorized.");
      if (!plugin.isProprietary)
        throw new Error("This endpoint is only for proprietary plugins.");

      const latestBuild = await prisma.build.findFirst({
        where: { pluginId: plugin.id },
        orderBy: { buildNumber: "desc" },
        select: { buildNumber: true },
      });
      const buildNumber = (latestBuild?.buildNumber || 0) + 1;

      let artifactFiles: { file: Express.Multer.File; ext: string }[] = [];

      if (plugin.pluginType === "PYTHON") {
        const artifact = files["artifact"]?.[0];
        if (!artifact) throw new Error("A .whl artifact file is required.");
        allFiles.push(artifact);
        if (!artifact.originalname.endsWith(".whl")) {
          throw new Error("Python artifact must be a .whl file.");
        }
        const valid = await verifyMagicNumber(artifact.path, ".whl");
        if (!valid) throw new Error("File content does not match .whl format.");
        artifactFiles.push({ file: artifact, ext: ".whl" });
      } else if (plugin.pluginType === "CPP") {
        const linuxFile = files["artifact_linux"]?.[0];
        const winFile = files["artifact_win"]?.[0];
        if (!linuxFile)
          throw new Error("A Linux .so artifact file is required.");
        if (!winFile)
          throw new Error("A Windows .dll artifact file is required.");
        allFiles.push(linuxFile, winFile);

        if (!linuxFile.originalname.endsWith(".so")) {
          throw new Error("Linux artifact must be a .so file.");
        }
        if (!winFile.originalname.endsWith(".dll")) {
          throw new Error("Windows artifact must be a .dll file.");
        }
        const linuxValid = await verifyMagicNumber(linuxFile.path, ".so");
        if (!linuxValid)
          throw new Error("File content does not match .so format.");
        const winValid = await verifyMagicNumber(winFile.path, ".dll");
        if (!winValid)
          throw new Error("File content does not match .dll format.");

        artifactFiles.push(
          { file: linuxFile, ext: ".so" },
          { file: winFile, ext: ".dll" },
        );
      } else {
        throw new Error("Unsupported plugin type.");
      }

      const artifactKeys: string[] = [];
      let build: any;

      try {
        for (const { file, ext } of artifactFiles) {
          const safeName = sanitizeFilename(file.originalname);
          const artifactKey = `artifacts/${slug}/${buildNumber}/${safeName}`;

          if (!ARTIFACT_KEY_REGEX.test(artifactKey)) {
            throw new Error("Generated storage key failed validation.");
          }

          const fileBuffer = await fs.promises.readFile(file.path);
          await storage.upload(artifactKey, fileBuffer, MIME_TYPES[ext]);
          artifactKeys.push(artifactKey);
        }

        const artifactUrl =
          plugin.pluginType === "PYTHON"
            ? `/api/v1/download/file/${encodeURIComponent(artifactKeys[0])}`
            : undefined;
        const artifactSize =
          plugin.pluginType === "PYTHON"
            ? artifactFiles[0].file.size
            : undefined;
        const artifactUrlLinux =
          plugin.pluginType === "CPP"
            ? `/api/v1/download/file/${encodeURIComponent(
                artifactKeys.find((k) => k.endsWith(".so"))!,
              )}`
            : undefined;
        const artifactSizeLinux =
          plugin.pluginType === "CPP"
            ? artifactFiles.find((f) => f.ext === ".so")!.file.size
            : undefined;
        const artifactUrlWin =
          plugin.pluginType === "CPP"
            ? `/api/v1/download/file/${encodeURIComponent(
                artifactKeys.find((k) => k.endsWith(".dll"))!,
              )}`
            : undefined;
        const artifactSizeWin =
          plugin.pluginType === "CPP"
            ? artifactFiles.find((f) => f.ext === ".dll")!.file.size
            : undefined;

        build = await prisma.build.create({
          data: {
            pluginId: plugin.id,
            buildNumber,
            status: "SUCCESS",
            triggerType: "UPLOAD",
            branch: "main",
            artifactUrl,
            artifactSize,
            artifactUrlLinux,
            artifactSizeLinux,
            artifactUrlWin,
            artifactSizeWin,
            finishedAt: new Date(),
          },
        });

        await vtQueue
          .add("scan", {
            versionId: plugin.id,
            pluginSlug: slug,
            artifactKeys,
          })
          .catch((e) =>
            console.error("[VT] Failed to enqueue scan:", e.message),
          );

        return { plugin, build };
      } catch (err) {
        if (build) {
          await prisma.build
            .delete({ where: { id: build.id } })
            .catch(() => {});
        }
        for (const key of artifactKeys) {
          await storage.delete(key).catch(() => {});
        }
        throw err;
      }
    } finally {
      for (const file of allFiles) {
        try {
          await fs.promises.unlink(file.path);
        } catch {}
      }
    }
  }
}

export const uploadService = new UploadService();
