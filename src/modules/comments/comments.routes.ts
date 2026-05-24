import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { commentsController } from "./comments.controller";

export const commentsRouter: Router = Router();

commentsRouter.get("/:slug", commentsController.getComments);
commentsRouter.get("/:slug/stream", commentsController.streamComments);
commentsRouter.post("/:slug", requireAuth, commentsController.createComment);
commentsRouter.delete(
  "/:slug/:commentId",
  requireAuth,
  commentsController.deleteComment,
);
