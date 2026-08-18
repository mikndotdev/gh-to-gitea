import { Elysia } from "elysia";
import { config, validateConfig } from "./config";
import { createMirror } from "./gitea";
import { type RepositoryCreatedPayload, verifySignature } from "./github";

const app = new Elysia()
  .get("/", ({ redirect }) => {
    return redirect("https://docs.mikn.dev/solutions/developers/gh-to-gitea");
  })
  .get("/health", ({ set }) => {
    const configuration = validateConfig();
    if (!configuration.valid) set.status = 503;
    return { ok: configuration.valid, configuration };
  })
  .post(
    "/webhook",
    async ({ request, set }) => {
      const raw = await request.text();
      const signature = request.headers.get("x-hub-signature-256") ?? undefined;

      if (!verifySignature(raw, signature, config.githubWebhookSecret)) {
        set.status = 401;
        return { error: "invalid signature" };
      }

      const event = request.headers.get("x-github-event");

      if (event === "ping") {
        return { ok: true };
      }

      if (event !== "repository") {
        return { ignored: `event: ${event}` };
      }

      let payload: RepositoryCreatedPayload;
      try {
        payload = JSON.parse(raw) as RepositoryCreatedPayload;
      } catch {
        set.status = 400;
        return { error: "invalid json" };
      }

      if (payload.action !== "created") {
        return { ignored: `action: ${payload.action}` };
      }

      const repo = payload.repository;
      const owner = repo.owner.login;

      if (config.githubOrgAllowlist.length > 0 && !config.githubOrgAllowlist.includes(owner)) {
        return { ignored: `owner not allowed: ${owner}` };
      }

      try {
        const result = await createMirror(repo);
        set.status = 202;
        return { mirrored: repo.full_name, status: result.status };
      } catch (error) {
        console.error(`Failed to mirror ${repo.full_name}:`, error);
        set.status = 502;
        return { error: "mirror failed" };
      }
    },
    {
      parse: "none",
    },
  );

if (import.meta.main) {
  const report = validateConfig();
  for (const issue of report.errors) {
    console.error(`config error: ${issue.name} ${issue.message}`);
  }
  for (const issue of report.warnings) {
    console.warn(`config warning: ${issue.name} ${issue.message}`);
  }
  app.listen(config.port);
}

export default app;
