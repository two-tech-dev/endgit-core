import { prisma } from "@endgit/database";
import { createStorage } from "@endgit/storage";

const VT_API_BASE = "https://www.virustotal.com/api/v3";
const VT_API_KEY = process.env.VT_API_KEY || "";
const POLL_INTERVAL_MS = 30_000;
const MAX_POLLS = 20;
const ARTIFACT_GAP_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface VTAnalysisResult {
  stats: {
    malicious: number;
    suspicious: number;
    undetected: number;
    harmless: number;
    timeout: number;
  };
  status: string;
  sha256?: string;
}

export class VirusTotalService {
  private storage = createStorage();

  async submitFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    form.append("file", blob, fileName);

    const res = await fetch(`${VT_API_BASE}/files`, {
      method: "POST",
      headers: { xapikey: VT_API_KEY },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VT upload failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  }

  async getAnalysis(analysisId: string): Promise<VTAnalysisResult> {
    const res = await fetch(`${VT_API_BASE}/analyses/${analysisId}`, {
      headers: { xapikey: VT_API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VT analysis fetch failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as {
      data: {
        attributes: {
          stats: VTAnalysisResult["stats"];
          status: string;
        };
        id: string;
      };
      meta?: { file_info?: { sha256?: string } };
    };

    return {
      stats: json.data.attributes.stats,
      status: json.data.attributes.status,
      sha256: json.meta?.file_info?.sha256,
    };
  }

  async pollUntilComplete(analysisId: string): Promise<VTAnalysisResult> {
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const result = await this.getAnalysis(analysisId);
      if (result.status === "completed") return result;
    }
    throw new Error("VT analysis timed out after 10 minutes");
  }

  async scanVersion(
    versionId: string,
    pluginSlug: string,
    artifactKeys: string[],
  ): Promise<void> {
    if (!VT_API_KEY) {
      console.warn("[VT] VT_API_KEY not set, skipping scan");
      await this.updateVersionStatus(versionId, "failed");
      return;
    }

    try {
      await this.updateVersionStatus(versionId, "scanning");

      let totalMalicious = 0;
      let totalSuspicious = 0;
      let totalUndetected = 0;
      let totalEngines = 0;
      let permalink = "";
      let scanDate: Date | null = null;

      for (let i = 0; i < artifactKeys.length; i++) {
        if (i > 0) await sleep(ARTIFACT_GAP_MS);

        const key = artifactKeys[i];
        const exists = await this.storage.exists(key);
        if (!exists) {
          console.warn(`[VT] Artifact not found: ${key}`);
          continue;
        }

        const fileBuffer = await this.storage.download(key);
        const fileName = key.split("/").pop() || `artifact-${i}`;

        const analysisId = await this.submitFile(fileBuffer, fileName);
        const result = await this.pollUntilComplete(analysisId);

        totalMalicious += result.stats.malicious;
        totalSuspicious += result.stats.suspicious;
        totalUndetected += result.stats.undetected;
        totalEngines +=
          result.stats.malicious +
          result.stats.suspicious +
          result.stats.undetected +
          result.stats.harmless +
          result.stats.timeout;

        if (result.sha256) {
          permalink = `https://www.virustotal.com/gui/file/${result.sha256}`;
        }
        scanDate = new Date();
      }

      await prisma.version.update({
        where: { id: versionId },
        data: {
          vtStatus: "completed",
          vtMalicious: totalMalicious,
          vtSuspicious: totalSuspicious,
          vtUndetected: totalUndetected,
          vtTotal: totalEngines,
          vtPermalink: permalink || null,
          vtScanDate: scanDate,
        },
      });
    } catch (err: any) {
      console.error(`[VT] Scan failed for version ${versionId}:`, err.message);
      await this.updateVersionStatus(versionId, "failed");
    }
  }

  private async updateVersionStatus(
    versionId: string,
    status: string,
  ): Promise<void> {
    await prisma.version.update({
      where: { id: versionId },
      data: { vtStatus: status },
    });
  }
}

export const virusTotalService = new VirusTotalService();
