import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { commentsService } from "./comments.service";
import { commentEvents } from "./comments.service";

export class CommentsController {
  async getComments(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const { comments, total, totalPages } = await commentsService.getComments(
        String(req.params.slug),
        page,
        limit,
      );
      res.json({
        success: true,
        data: comments,
        pagination: { page, limit, total, totalPages },
      });
    } catch (error: any) {
      res.status(error.message === "Plugin not found" ? 404 : 500).json({
        success: false,
        error: error.message || "Failed to fetch comments",
      });
    }
  }

  async createComment(req: AuthRequest, res: Response) {
    try {
      const comment = await commentsService.createComment(
        String(req.params.slug),
        req.user!.id,
        req.body.body,
        req.body.parentId,
      );
      res.status(201).json({ success: true, data: comment });
    } catch (error: any) {
      const status =
        error.message === "Plugin not found" ||
        error.message === "Parent comment not found"
          ? 404
          : error.message.includes("cannot be empty") ||
              error.message.includes("Cannot reply")
            ? 400
            : 500;
      res.status(status).json({
        success: false,
        error: error.message || "Failed to create comment",
      });
    }
  }

  async deleteComment(req: AuthRequest, res: Response) {
    try {
      const isAdmin = req.user!.trustLevel === "ADMIN";
      await commentsService.deleteComment(
        String(req.params.commentId),
        req.user!.id,
        isAdmin,
      );
      res.json({ success: true, message: "Comment deleted" });
    } catch (error: any) {
      const status =
        error.message === "Comment not found"
          ? 404
          : error.message === "Not authorized"
            ? 403
            : 500;
      res.status(status).json({
        success: false,
        error: error.message || "Failed to delete comment",
      });
    }
  }

  async streamComments(req: Request, res: Response) {
    const slug = String(req.params.slug);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const listener = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    commentEvents.on(`comment:${slug}`, listener);

    req.on("close", () => {
      commentEvents.off(`comment:${slug}`, listener);
    });
  }
}

export const commentsController = new CommentsController();
