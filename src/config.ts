function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseMirrorPrivate(value: string | undefined): "auto" | boolean {
  const normalized = (value ?? "auto").toLowerCase();
  if (normalized === "auto" || normalized === "") return "auto";
  return parseBool(normalized, false);
}

export type Config = {
  port: number;
  githubOrgAllowlist: string[];
  githubToken: string;
  githubWebhookSecret: string;
  giteaUrl: string;
  giteaToken: string;
  giteaOrg: string;
  mirrorInterval: string;
  mirrorLfs: boolean;
  mirrorPrivate: "auto" | boolean;
  logLevel: string;
};

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  githubOrgAllowlist: parseList(process.env.GITHUB_ORG),
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
  giteaUrl: (process.env.GITEA_URL ?? "").replace(/\/+$/, ""),
  giteaToken: process.env.GITEA_TOKEN ?? "",
  giteaOrg: process.env.GITEA_ORG ?? "",
  mirrorInterval: optional("MIRROR_INTERVAL", "8h0m0s"),
  mirrorLfs: parseBool(process.env.MIRROR_LFS, false),
  mirrorPrivate: parseMirrorPrivate(process.env.MIRROR_PRIVATE),
  logLevel: optional("LOG_LEVEL", "info"),
};

export type ConfigIssue = {
  name: string;
  message: string;
};

export type ConfigReport = {
  valid: boolean;
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
};

const REQUIRED = ["GITHUB_WEBHOOK_SECRET", "GITEA_URL", "GITEA_TOKEN", "GITEA_ORG"] as const;

const DURATION = /^(\d+(h|m|s))+$/;
const BOOL_VALUES = ["1", "0", "true", "false", "yes", "no", "on", "off"];

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateConfig(): ConfigReport {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];

  for (const name of REQUIRED) {
    if (!process.env[name]) {
      errors.push({ name, message: "is required but not set" });
    }
  }

  const giteaUrl = process.env.GITEA_URL;
  if (giteaUrl && !isValidHttpUrl(giteaUrl)) {
    errors.push({ name: "GITEA_URL", message: "must be a valid http(s) URL" });
  }

  const interval = process.env.MIRROR_INTERVAL;
  if (interval && !DURATION.test(interval)) {
    errors.push({
      name: "MIRROR_INTERVAL",
      message: "must be a Go duration such as 8h0m0s",
    });
  }

  const mirrorPrivate = process.env.MIRROR_PRIVATE?.toLowerCase();
  if (mirrorPrivate && mirrorPrivate !== "auto" && !BOOL_VALUES.includes(mirrorPrivate)) {
    errors.push({
      name: "MIRROR_PRIVATE",
      message: "must be auto, true, or false",
    });
  }

  const mirrorLfs = process.env.MIRROR_LFS?.toLowerCase();
  if (mirrorLfs && !BOOL_VALUES.includes(mirrorLfs)) {
    warnings.push({
      name: "MIRROR_LFS",
      message: "is not a recognized boolean; treated as false",
    });
  }

  const port = process.env.PORT;
  if (port) {
    const parsed = Number(port);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      warnings.push({ name: "PORT", message: "is not a valid port; using 3000" });
    }
  }

  if (!process.env.GITHUB_TOKEN) {
    warnings.push({
      name: "GITHUB_TOKEN",
      message: "is not set; private repositories cannot be mirrored",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
