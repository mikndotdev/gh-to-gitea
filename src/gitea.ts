import { config } from "./config";

export type MirrorSource = {
  name: string;
  clone_url: string;
  private: boolean;
  description: string | null;
};

export type MirrorResult = {
  status: "created" | "exists";
};

export async function createMirror(repo: MirrorSource): Promise<MirrorResult> {
  const body: Record<string, unknown> = {
    clone_addr: repo.clone_url,
    repo_name: repo.name,
    repo_owner: config.giteaOrg,
    service: "github",
    mirror: true,
    private: config.mirrorPrivate === "auto" ? repo.private : config.mirrorPrivate,
    description: repo.description ?? "",
    lfs: config.mirrorLfs,
  };

  if (config.githubToken) {
    body.auth_token = config.githubToken;
  }

  if (config.mirrorInterval) {
    body.mirror_interval = config.mirrorInterval;
  }

  const response = await fetch(`${config.giteaUrl}/api/v1/repos/migrate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${config.giteaToken}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    return { status: "created" };
  }

  if (response.status === 409) {
    return { status: "exists" };
  }

  const detail = await response.text();

  if (response.status === 422 && /already exist/i.test(detail)) {
    return { status: "exists" };
  }

  throw new Error(`Gitea migrate failed (${response.status}): ${detail}`);
}
