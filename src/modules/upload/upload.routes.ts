import { Router } from "express";
import multer from "multer";
import os from "os";
import { requireAuth, requireTrusted } from "../../middleware/auth";
import { proprietaryUploadRateLimit } from "../../middleware/rateLimit";
import { uploadController } from "./upload.controller";

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

export const uploadRouter: Router = Router();

uploadRouter.post(
  "/plugin",
  requireAuth,
  requireTrusted,
  proprietaryUploadRateLimit,
  upload.fields([
    { name: "artifact", maxCount: 1 },
    { name: "artifact_linux", maxCount: 1 },
    { name: "artifact_win", maxCount: 1 },
  ]),
  uploadController.uploadPlugin,
);

uploadRouter.post(
  "/plugin/:slug/version",
  requireAuth,
  requireTrusted,
  proprietaryUploadRateLimit,
  upload.fields([
    { name: "artifact", maxCount: 1 },
    { name: "artifact_linux", maxCount: 1 },
    { name: "artifact_win", maxCount: 1 },
  ]),
  uploadController.uploadNewVersion,
);
