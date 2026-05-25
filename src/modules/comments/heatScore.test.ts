import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("recalculateAllHeatScores", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("recalculates heat scores for all approved plugins", async () => {
    const mod = await import("./comments.service");
    mockPrisma.plugin.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    mockPrisma.pluginComment.count.mockResolvedValue(5);
    mockPrisma.pluginAnalytics.findMany.mockResolvedValue([
      { downloads: 100 },
      { downloads: 50 },
    ]);
    mockPrisma.plugin.update.mockResolvedValue({});

    await mod.recalculateAllHeatScores();

    expect(mockPrisma.plugin.update).toHaveBeenCalledTimes(2);
    // heatScore = comments * 5 + downloads = 5 * 5 + 150 = 175
    expect(mockPrisma.plugin.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { heatScore: 175 },
    });
  });
});
