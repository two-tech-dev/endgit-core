import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("CommentsService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./comments.service");
    service = mod.commentsService;
  });

  describe("getComments", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getComments("nonexistent", 1, 10)).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns threaded comments", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.pluginComment.findMany.mockResolvedValue([
        {
          id: "c1",
          body: "Parent comment",
          parentId: null,
          replies: [{ id: "c2", body: "Reply", parentId: "c1" }],
        },
      ]);
      mockPrisma.pluginComment.count.mockResolvedValue(1);

      const result = await service.getComments("test-plugin", 1, 10);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].replies).toHaveLength(1);
    });
  });

  describe("createComment", () => {
    it("throws when body is empty", async () => {
      await expect(
        service.createComment("test-plugin", "user1", ""),
      ).rejects.toThrow("Comment body cannot be empty");
    });

    it("throws when body is whitespace only", async () => {
      await expect(
        service.createComment("test-plugin", "user1", "   "),
      ).rejects.toThrow("Comment body cannot be empty");
    });

    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.createComment("nonexistent", "user1", "Hello"),
      ).rejects.toThrow("Plugin not found");
    });

    it("creates a top-level comment", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.pluginComment.create.mockResolvedValue({
        id: "c1",
        body: "Hello",
        user: { username: "user1" },
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      const result = await service.createComment(
        "test-plugin",
        "user1",
        "Hello",
      );
      expect(result.body).toBe("Hello");
      expect(mockPrisma.plugin.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { commentCount: { increment: 1 } },
      });
    });

    it("creates a reply to a parent comment", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.pluginComment.findUnique.mockResolvedValue({
        pluginId: "p1",
        parentId: null,
      });
      mockPrisma.pluginComment.create.mockResolvedValue({
        id: "c2",
        body: "Reply",
        user: { username: "user2" },
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      const result = await service.createComment(
        "test-plugin",
        "user2",
        "Reply",
        "c1",
      );
      expect(result.body).toBe("Reply");
    });

    it("throws when replying to a reply (nested reply)", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.pluginComment.findUnique.mockResolvedValue({
        pluginId: "p1",
        parentId: "c1", // This is already a reply
      });

      await expect(
        service.createComment("test-plugin", "user1", "Nested reply", "c2"),
      ).rejects.toThrow("Cannot reply to a reply");
    });

    it("throws when parent comment not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.pluginComment.findUnique.mockResolvedValue(null);

      await expect(
        service.createComment("test-plugin", "user1", "Reply", "nonexistent"),
      ).rejects.toThrow("Parent comment not found");
    });

    it("throws when parent comment belongs to different plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.pluginComment.findUnique.mockResolvedValue({
        pluginId: "p2",
        parentId: null,
      });

      await expect(
        service.createComment("test-plugin", "user1", "Reply", "c1"),
      ).rejects.toThrow("Parent comment not found");
    });
  });

  describe("deleteComment", () => {
    it("throws when comment not found", async () => {
      mockPrisma.pluginComment.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteComment("nonexistent", "user1", false),
      ).rejects.toThrow("Comment not found");
    });

    it("throws when user is not authorized", async () => {
      mockPrisma.pluginComment.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user1",
        pluginId: "p1",
        parentId: null,
        plugin: { slug: "test" },
        _count: { replies: 0 },
      });

      await expect(service.deleteComment("c1", "user2", false)).rejects.toThrow(
        "Not authorized",
      );
    });

    it("allows admin to delete any comment", async () => {
      mockPrisma.pluginComment.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user1",
        pluginId: "p1",
        parentId: null,
        plugin: { slug: "test" },
        _count: { replies: 0 },
      });
      mockPrisma.pluginComment.delete.mockResolvedValue({});
      mockPrisma.plugin.update.mockResolvedValue({});

      const result = await service.deleteComment("c1", "admin1", true);
      expect(result.deleted).toBe(true);
    });

    it("decrements comment count by 1 + replies", async () => {
      mockPrisma.pluginComment.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user1",
        pluginId: "p1",
        parentId: null,
        plugin: { slug: "test" },
        _count: { replies: 3 },
      });
      mockPrisma.pluginComment.delete.mockResolvedValue({});
      mockPrisma.plugin.update.mockResolvedValue({});

      await service.deleteComment("c1", "user1", false);

      expect(mockPrisma.plugin.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { commentCount: { decrement: 4 } },
      });
    });
  });
});
