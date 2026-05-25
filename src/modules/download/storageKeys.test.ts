import { describe, it, expect } from "vitest";
import { normalizeDownloadArtifactKey } from "./storageKeys";

describe("normalizeDownloadArtifactKey", () => {
  it("accepts a valid artifact key", () => {
    const key = "artifacts/my-plugin/1/endstone_my-plugin.so";
    expect(normalizeDownloadArtifactKey(key)).toBe(key);
  });

  it("accepts a valid .whl key", () => {
    const key = "artifacts/my-plugin/1/endstone_my-plugin.whl";
    expect(normalizeDownloadArtifactKey(key)).toBe(key);
  });

  it("accepts a valid .dll key", () => {
    const key = "artifacts/my-plugin/1/endstone_my-plugin.dll";
    expect(normalizeDownloadArtifactKey(key)).toBe(key);
  });

  it("strips the /api/v1/download/file/ prefix", () => {
    const key =
      "/api/v1/download/file/artifacts/my-plugin/1/endstone_my-plugin.so";
    expect(normalizeDownloadArtifactKey(key)).toBe(
      "artifacts/my-plugin/1/endstone_my-plugin.so",
    );
  });

  it("decodes URI-encoded characters", () => {
    const key = "artifacts/my-plugin/1/endstone_my%2Dplugin.so";
    expect(normalizeDownloadArtifactKey(key)).toBe(
      "artifacts/my-plugin/1/endstone_my-plugin.so",
    );
  });

  it("throws on invalid key format", () => {
    expect(() => normalizeDownloadArtifactKey("invalid-key")).toThrow(
      "Invalid artifact key",
    );
  });

  it("throws on path traversal attempt", () => {
    expect(() =>
      normalizeDownloadArtifactKey("artifacts/../../etc/passwd"),
    ).toThrow("Invalid artifact key");
  });

  it("throws on key with uppercase slug", () => {
    expect(() =>
      normalizeDownloadArtifactKey("artifacts/MyPlugin/1/file.so"),
    ).toThrow("Invalid artifact key");
  });

  it("throws on key with invalid extension", () => {
    expect(() =>
      normalizeDownloadArtifactKey("artifacts/my-plugin/1/file.exe"),
    ).toThrow("Invalid artifact key");
  });

  it("validates expectedPluginSlug matches", () => {
    const key = "artifacts/my-plugin/1/endstone_my-plugin.so";
    expect(normalizeDownloadArtifactKey(key, "my-plugin")).toBe(key);
  });

  it("throws when expectedPluginSlug does not match", () => {
    const key = "artifacts/my-plugin/1/endstone_my-plugin.so";
    expect(() => normalizeDownloadArtifactKey(key, "other-plugin")).toThrow(
      "Artifact does not belong to this plugin",
    );
  });

  it("throws on zero build number", () => {
    expect(() =>
      normalizeDownloadArtifactKey("artifacts/my-plugin/0/file.so"),
    ).toThrow("Invalid artifact key");
  });

  it("accepts underscores and dots in filename", () => {
    const key = "artifacts/my-plugin/42/endstone_my.plugin-v2.so";
    expect(normalizeDownloadArtifactKey(key)).toBe(key);
  });
});
