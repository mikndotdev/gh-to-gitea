import { config, validateConfig } from "../src/config";
import { createMirror, type MirrorSource } from "../src/gitea";

type GithubRepo = MirrorSource & { full_name: string };

async function listOrgRepos(org: string): Promise<GithubRepo[]> {
  const repos: GithubRepo[] = [];
  const perPage = 100;
  let page = 1;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gh-to-gitea-seed",
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }

  while (true) {
    const url = new URL(`https://api.github.com/orgs/${org}/repos`);
    url.searchParams.set("type", "all");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub list repos failed for "${org}" (${response.status}): ${detail}`);
    }

    const batch = (await response.json()) as GithubRepo[];
    repos.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return repos;
}

async function seed() {
  const orgs = config.githubOrgAllowlist;
  if (orgs.length === 0) {
    throw new Error(
      "Set GITHUB_ORG (comma-separated for several orgs) to seed existing repositories.",
    );
  }

  const report = validateConfig();
  if (!report.valid) {
    const details = report.errors.map((issue) => `  ${issue.name} ${issue.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${details}`);
  }

  let created = 0;
  let existed = 0;
  let failed = 0;

  for (const org of orgs) {
    console.log(`\nListing repositories in "${org}"...`);
    const repos = await listOrgRepos(org);
    console.log(`Found ${repos.length} repositories. Mirroring into "${config.giteaOrg}".`);

    for (const repo of repos) {
      try {
        const result = await createMirror(repo);
        if (result.status === "created") {
          created += 1;
          console.log(`  created  ${repo.full_name}`);
        } else {
          existed += 1;
          console.log(`  exists   ${repo.full_name}`);
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  failed   ${repo.full_name}: ${message}`);
      }
    }
  }

  console.log(`\nDone. created=${created} exists=${existed} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

if (import.meta.main) {
  seed().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
