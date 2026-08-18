# gh-to-gitea

<p align="center">
 <img src="https://cdn.mikn.dev/branding/mikan-vtube.png" width="100">
</p>

Tired of GitHub going down? Automatically mirror your code on a server you own!

A simple Elysia/Bun server that
receives a GitHub organization webhook and, whenever a repository is created, creates a
matching pull mirror in a [Gitea](https://gitea.io) / [Forgejo](https://forgejo.org)
instance automatically.

## Setup / Run locally

1. Install packages

   ```bash
   bun install
   ```

2. Copy the example env file and fill it in

   ```bash
   cp .env.example .env
   ```

3. Run it

   ```bash
   bun run dev     # watch mode
   bun run start   # once
   ```

   `GET /health` reports configuration health: `200` with
   `{ "ok": true, "configuration": { "valid": true, "errors": [], "warnings": [] } }`
   when the environment is valid, or `503` with the offending variables listed under
   `configuration.errors`.
   Invalid config is logged at startup but does not crash the server, so this endpoint
   stays reachable to diagnose it.

## Deploy
### Vercel

- Deploy once, and leave it to do it's job!
- Click the button below to configure and deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmikndotdev%2Fgh-to-gitea&env=GITHUB_ORG,GITHUB_TOKEN,GITHUN_WEBHOOK_SECRET,GITEA_URL,GITEA_TOKEN,GITEA_ORG&envDescription=Configure%20the%20tokens%20for%20GitHub%20and%20Gitea%20here.&envLink=https%3A%2F%2Fdocs.mikn.dev%2Fsolutions%2Fdevelopers%2Fgh-to-gitea%23environment-variables)

### Docker

- Docker images are available at [cr.mikandev.com](https://cr.mikandev.com/image/mikndotdev%2Fgh-to-gitea).

## Seeding existing repositories

The webhook only mirrors repos created _after_ it is installed. To back-fill every repo
that already exists in the org(s) named by `GITHUB_ORG`, run:

```bash
bun run seed
```

It reads the same `.env`, lists all repositories in each org via the GitHub API, and
mirrors each one with `createMirror` (identical settings to the webhook). Already-mirrored
repos are reported as `exists` and skipped, so it is safe to re-run. `GITHUB_TOKEN` is
required to include private repositories. This may also be useful if the webhook fails to be sent for whatever reason, and a desync occurs.

## Environment variables

| Var                     | Required          | Default  | Description                                                                                 |
| ----------------------- | ----------------- | -------- | ------------------------------------------------------------------------------------------- |
| `PORT`                  | no                | `3000`   | Local listen port (Vercel injects its own).                                                 |
| `GITHUB_ORG`            | no                | —        | Owner allowlist. Empty accepts any owner the webhook delivers; comma-separated for several. |
| `GITHUB_TOKEN`          | for private repos | —        | PAT (repo scope). Sent to Gitea as the clone `auth_token` so it can pull private sources.   |
| `GITHUB_WEBHOOK_SECRET` | yes               | —        | HMAC secret verifying `X-Hub-Signature-256`.                                                |
| `GITEA_URL`             | yes               | —        | Base URL, e.g. `https://gitea.example.com` (no `/api/v1`).                                  |
| `GITEA_TOKEN`           | yes               | —        | Gitea/Forgejo API token with repo create rights in `GITEA_ORG`.                             |
| `GITEA_ORG`             | yes               | —        | Destination owner for every mirror. May be an org **or** a user.                            |
| `MIRROR_INTERVAL`       | no                | `8h0m0s` | Pull-mirror sync cadence.                                                                   |
| `MIRROR_LFS`            | no                | `false`  | Mirror Git LFS objects.                                                                     |
| `MIRROR_PRIVATE`        | no                | `auto`   | `auto` matches the source visibility; `true`/`false` forces it.                             |
| `LOG_LEVEL`             | no                | `info`   | Log verbosity.                                                                              |

## GitHub webhook configuration

Add the webhook on the **organization** (Settings → Webhooks):

- **Payload URL:** your server URL + `/webhook` (e.g. `https://host/webhook`)
- **Content type:** `application/json`
- **Secret:** the same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** select individual events → **Repositories**

## Gitea token

Create the token under a user that can create repositories in `GITEA_ORG` (repository
read/write scope). The mirror is created with `mirror: true`, so Gitea keeps it in sync with
GitHub on the `MIRROR_INTERVAL` schedule.
