import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { uploadService } from "./upload.service";

export class UploadController {
  async uploadPlugin(req: AuthRequest, res: Response) {
    try {
      const result = await uploadService.uploadPlugin(
        req.body,
        req.files as Record<string, Express.Multer.File[]>,
        req.user!.id,
      );
      res.status(201).json({
        success: true,
        data: {
          plugin: result.plugin,
          build: result.build,
        },
      });
    } catch (error: any) {
      const message = error.message || "Upload failed";
      const status =
        message.includes("already exists") ||
        message.includes("required") ||
        message.includes("Invalid") ||
        message.includes("Maximum") ||
        message.includes("reached") ||
        message.includes("does not match")
          ? 400
          : 500;
      res.status(status).json({ success: false, error: message });
    }
  }

  async uploadNewVersion(req: AuthRequest, res: Response) {
    try {
      const result = await uploadService.uploadNewVersion(
        String(req.params.slug),
        req.files as Record<string, Express.Multer.File[]>,
        req.user!.id,
      );
      res.status(201).json({
        success: true,
        data: {
          plugin: result.plugin,
          build: result.build,
        },
      });
    } catch (error: any) {
      const message = error.message || "Upload failed";
      const status =
        message.includes("Not authorized")
          ? 403
          : message.includes("not found")
            ? 404
            : message.includes("required") ||
                message.includes("Invalid") ||
                message.includes("does not match") ||
                message.includes("only for proprietary")
              ? 400
              : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
}

export const uploadController = new UploadController();
