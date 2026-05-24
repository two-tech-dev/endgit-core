import { prisma } from "@endgit/database";
import { EventEmitter } from "events";

const commentEvents = new EventEmitter();
commentEvents.setMaxListeners(100);

export { commentEvents };

async function recalculateHeatScore(pluginId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [commentsLast7d, analytics] = await Promise.all([
    prisma.pluginComment.count({
      where: { pluginId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.pluginAnalytics.findMany({
      where: { pluginId, date: { gte: sevenDaysAgo } },
      select: { downloads: true },
    }),
  ]);

  const downloadsLast7d = analytics.reduce(
    (sum, a) => sum + (a.downloads || 0),
    0,
  );
  const heatScore = commentsLast7d * 5 + downloadsLast7d;

  await prisma.plugin.update({
    where: { id: pluginId },
    data: { heatScore },
  });
}

export class CommentsService {
  async getComments(slug: string, page: number, limit: number) {
    const plugin = await prisma.plugin.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!plugin) throw new Error("Plugin not found");

    const where = { pluginId: plugin.id, parentId: null };

    const [comments, total] = await Promise.all([
      prisma.pluginComment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              trustLevel: true,
            },
          },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  trustLevel: true,
                },
              },
            },
          },
        },
      }),
      prisma.pluginComment.count({ where }),
    ]);

    return { comments, total, totalPages: Math.ceil(total / limit) };
  }

  async createComment(
    slug: string,
    userId: string,
    body: string,
    parentId?: string,
  ) {
    if (!body || !body.trim()) throw new Error("Comment body cannot be empty");

    const plugin = await prisma.plugin.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!plugin) throw new Error("Plugin not found");

    if (parentId) {
      const parent = await prisma.pluginComment.findUnique({
        where: { id: parentId },
        select: { pluginId: true, parentId: true },
      });
      if (!parent || parent.pluginId !== plugin.id)
        throw new Error("Parent comment not found");
      if (parent.parentId) throw new Error("Cannot reply to a reply");
    }

    const comment = await prisma.pluginComment.create({
      data: {
        body: body.trim(),
        userId,
        pluginId: plugin.id,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            trustLevel: true,
          },
        },
      },
    });

    await prisma.plugin.update({
      where: { id: plugin.id },
      data: { commentCount: { increment: 1 } },
    });

    recalculateHeatScore(plugin.id).catch(() => {});

    commentEvents.emit(`comment:${slug}`, {
      type: "new",
      comment: { ...comment, replies: [] },
      parentId: parentId || null,
    });

    return comment;
  }

  async deleteComment(commentId: string, userId: string, isAdmin: boolean) {
    const comment = await prisma.pluginComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        pluginId: true,
        parentId: true,
        plugin: { select: { slug: true } },
        _count: { select: { replies: true } },
      },
    });
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== userId && !isAdmin)
      throw new Error("Not authorized");

    const deletedCount = 1 + (comment._count.replies || 0);

    await prisma.pluginComment.delete({ where: { id: commentId } });

    await prisma.plugin.update({
      where: { id: comment.pluginId },
      data: { commentCount: { decrement: deletedCount } },
    });

    recalculateHeatScore(comment.pluginId).catch(() => {});

    commentEvents.emit(`comment:${comment.plugin.slug}`, {
      type: "delete",
      commentId,
      parentId: comment.parentId,
    });

    return { deleted: true };
  }
}

export async function recalculateAllHeatScores() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const plugins = await prisma.plugin.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });

  for (const plugin of plugins) {
    await recalculateHeatScore(plugin.id);
  }
}

export const commentsService = new CommentsService();
