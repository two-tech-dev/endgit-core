import { parse } from "yaml";

export interface EndgitConfig {
  name?: string;
  icon?: string;
  branch?: string[];
}

export function parseEndgitConfig(rawYaml: string): EndgitConfig {
  const doc = parse(rawYaml);

  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid .endgit.yml: must be a YAML object");
  }

  const config: EndgitConfig = {};

  if (doc.name !== undefined) {
    if (typeof doc.name !== "string") {
      throw new Error("Invalid .endgit.yml: 'name' must be a string");
    }
    if (doc.name.length > 64) {
      throw new Error("Invalid .endgit.yml: 'name' must be 64 characters or less");
    }
    config.name = doc.name;
  }

  if (doc.icon !== undefined) {
    if (typeof doc.icon !== "string") {
      throw new Error("Invalid .endgit.yml: 'icon' must be a string");
    }
    config.icon = doc.icon;
  }

  if (doc.branch !== undefined) {
    if (typeof doc.branch === "string") {
      config.branch = [doc.branch];
    } else if (Array.isArray(doc.branch)) {
      if (!doc.branch.every((b: unknown) => typeof b === "string")) {
        throw new Error("Invalid .endgit.yml: 'branch' must be a string or array of strings");
      }
      config.branch = doc.branch;
    } else {
      throw new Error("Invalid .endgit.yml: 'branch' must be a string or array of strings");
    }
  }

  return config;
}
