Yes. I’d freeze the design around this architecture:

```text
                         ┌──────────────────────────────┐
                         │       Next.js / Vercel      │
                         │                              │
Browser ── Google OIDC ─►│ UI + API + device pairing  │
                         │                              │
                         │ Vercel OIDC → GCP WIF       │
                         └───────┬─────────┬────────────┘
                                 │         │
                         Firestore│         │Cloud Tasks enqueue
                                 │         ▼
                                 │   ┌───────────────┐
                                 │   │  Cloud Tasks  │
                                 │   │ launch queue  │
                                 │   └───────┬───────┘
                                 │           │ OAuth
                                 │           ▼
                                 │   Cloud Run Jobs API
                                 │           │
                                 │           ▼
                                 │   ┌────────────────┐
                                 └──►│ media-worker   │
                                     │ Cloud Run Job  │
                                     │ yt-dlp         │
                                     │ ffmpeg         │
                                     └───────┬────────┘
                                             │
                                             ▼
                                      Private GCS
                                             ▲
                                             │ signed URL
                                             │
Garmin ── device bearer token ──► Vercel ────┘
   │
   └── Wi-Fi ──► GCS MP3 download
                   │
                   ▼
          Garmin native media player
```

There is one change from our earlier design that I think is worth making: **Cloud Tasks should launch a Cloud Run Job rather than hold open an HTTP request to an ffmpeg worker.** Cloud Tasks HTTP dispatches are bounded much more tightly, while Cloud Run Jobs support task timeouts up to seven days and their own retry policy. Cloud Tasks becomes the durable *launch queue*; Cloud Run Jobs owns the actual media execution. ([Google Cloud][1])

## 1. Monorepo and developer environment

**Required stack:** GitHub, pnpm, Node 24 LTS, Python 3.14, `uv`, Terraform, `mise`, `just`, Lefthook, Renovate, Docker.

I’d use one repository:

```text
garmin-audio/
├── apps/
│   ├── web/                   # Next.js / Vercel
│   ├── worker/                # Cloud Run Job
│   └── garmin/                # Connect IQ Audio Content Provider
│
├── packages/
│   └── contracts/             # OpenAPI + fixtures
│
├── infra/
│   ├── bootstrap/             # Terraform state + initial CI identity
│   ├── prod/
│   └── modules/
│       ├── artifact-registry/
│       ├── firestore/
│       ├── identity/
│       ├── observability/
│       ├── processing/
│       ├── storage/
│       └── vercel/
│
├── scripts/
│   ├── garmin-check.sh
│   ├── terraform-check.sh
│   └── bootstrap-dev.sh
│
├── biome.json
├── lefthook.yml
├── mise.toml
├── justfile
├── pnpm-workspace.yaml
├── renovate.json
└── README.md
```

Use `mise.toml` to pin local toolchains rather than relying on whatever happens to be installed:

```toml
[tools]
node = "24"
python = "3.14"
terraform = "latest"
uv = "latest"
lefthook = "latest"
just = "latest"
```

For reproducibility, CI should additionally pin exact action/container versions and commit `pnpm-lock.yaml`, `uv.lock`, and `.terraform.lock.hcl`.

Node 24 is currently the LTS line; Next.js 16.3.3 is the current Active LTS security release as of August 2026. ([Node.js][2])

---

## 2. Web application

**Required stack:** Next.js 16.3.x, React, TypeScript, Node 24 LTS, pnpm, Auth.js, Zod, TanStack Query, Tailwind CSS 4, Biome, Vitest, Testing Library, Playwright, `@vercel/oidc`, Google auth libraries.

Host this on **Vercel**.

Responsibilities:

```text
apps/web
├── authentication
├── media library UI
├── create processing jobs
├── retry failed jobs
├── Garmin pairing
├── Garmin feed API
├── signed GCS URL generation
└── device management
```

The UI can stay extremely small:

```text
┌────────────────────────────────────────────────┐
│ Add audio                                      │
│ [ YouTube URL________________________ ] [Add]  │
├────────────────────────────────────────────────┤
│ Long Run Mix                 ✓ Ready     Garmin│
│ Podcast 143                  ⟳ Encoding        │
│ Lecture                      ✕ Failed   [Retry]│
├────────────────────────────────────────────────┤
│ Garmin                                        │
│ Forerunner ...        synced 4 min ago        │
│                              [Revoke device]   │
└────────────────────────────────────────────────┘
```

I’d use Server Components where they make sense, but keep job-status polling in a small TanStack Query client component.

### Web API

Admin routes require the authenticated Google session:

```text
POST   /api/media
GET    /api/media
PATCH  /api/media/:id
DELETE /api/media/:id

POST   /api/jobs/:id/retry

POST   /api/garmin/pair/claim
GET    /api/devices
DELETE /api/devices/:id
```

Garmin-facing routes:

```text
POST /api/garmin/pair/start
GET  /api/garmin/pair/status

GET  /api/garmin/feed?since=42
POST /api/garmin/sync-report        # optional
```

Every request/response should be validated with Zod.

---

## 3. Web authentication

**Required stack:** Auth.js, Google OAuth/OIDC, Vercel encrypted environment variables.

There is exactly one human user, so don't build RBAC, organizations or user tables.

Authenticate with Google and authorize against the immutable Google `sub` claim:

```ts
if (session.user.googleSub !== env.ALLOWED_GOOGLE_SUB) {
  throw new ForbiddenError();
}
```

Use the email only for display.

Secrets kept in Vercel:

```text
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ALLOWED_GOOGLE_SUB
```

Do **not** put secret values in Terraform because that unnecessarily puts them into Terraform state.

All admin routes require the human session. Garmin routes use the separate device credential described below.

---

## 4. Vercel → Google Cloud identity

**Required stack:** Vercel OIDC, Google Workload Identity Federation, IAM service accounts, Terraform.

This should be entirely keyless at runtime:

```text
Vercel deployment
      │
      │ Vercel OIDC JWT
      ▼
Google Workload Identity Federation
      │
      ▼
vercel-runtime@project.iam.gserviceaccount.com
```

Vercel supports OIDC federation with GCP and recommends the team-specific issuer. Its claims can distinguish project and deployment environment, so production can be granted GCP access while previews are excluded. ([Vercel][3])

Terraform should configure the WIF provider with an exact condition around:

```text
Vercel team
AND exact Vercel project
AND environment == production
```

The Vercel runtime service account receives only:

```text
Firestore access required by web
Cloud Tasks enqueue
IAM signBlob on the dedicated URL signer identity
```

No project Editor role. No service-account JSON key.

---

## 5. Job state and application data

**Required stack:** Firestore Native mode, Terraform, Zod schemas in web, Google Cloud Firestore client in worker.

Use Firestore as the **canonical business state**, not Cloud Tasks.

Suggested collections:

```text
/media/{mediaId}
/jobs/{jobId}
/devices/{deviceId}
/pairings/{pairingId}
/system/library
```

A media document:

```ts
type Media = {
  id: string

  source: {
    type: "youtube"
    url: string
    sourceId?: string
  }

  title?: string
  artist?: string
  durationSeconds?: number

  profile: "music-128" | "speech-96"

  status:
    | "queued"
    | "processing"
    | "ready"
    | "failed"
    | "deleted"

  syncToGarmin: boolean
  revision?: number

  output?: {
    object: string
    bytes: number
    sha256: string
  }

  activeJobId?: string

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Job:

```ts
type Job = {
  id: string
  mediaId: string

  state:
    | "queued"
    | "downloading"
    | "transcoding"
    | "uploading"
    | "ready"
    | "failed"

  attempts: number

  progress?: {
    phase: string
    percent?: number
  }

  lease?: {
    owner: string
    expiresAt: Timestamp
  }

  heartbeatAt?: Timestamp

  error?: {
    code: string
    message: string
    retryable: boolean
  }

  createdAt: Timestamp
  startedAt?: Timestamp
  completedAt?: Timestamp
}
```

`system/library` carries one monotonically increasing revision:

```json
{
  "revision": 184
}
```

That revision drives incremental Garmin sync.

---

## 6. Queueing and job orchestration

**Required stack:** Google Cloud Tasks, Cloud Run Jobs API, OAuth service identity, Firestore.

The web app does:

```text
1. Firestore: create Media + Job
2. Cloud Tasks: enqueue launch request
3. Return job ID immediately
```

Cloud Tasks does **not** call your worker over HTTP.

Instead:

```text
Cloud Tasks
    │
    │ authenticated POST
    ▼
https://run.googleapis.com/v2/.../jobs/media-worker:run
```

The task body supplies the job ID through a Cloud Run Job override:

```json
{
  "overrides": {
    "containerOverrides": [
      {
        "env": [
          {
            "name": "JOB_ID",
            "value": "47b..."
          }
        ]
      }
    ],
    "taskCount": 1,
    "timeout": "7200s"
  }
}
```

Cloud Run's Jobs API supports per-execution environment/argument overrides. ([Google Cloud Documentation][4])

### Cloud Tasks policy

Start with:

```text
max attempts:          5
min backoff:           5 seconds
max backoff:           5 minutes
max retry duration:    30 minutes
```

Those retries mean:

> "Could Google successfully start my Cloud Run Job?"

They do **not** mean:

> "Did ffmpeg succeed?"

That distinction keeps the architecture clean.

Use a deterministic task name based on:

```text
sha256(jobId + launchGeneration)
```

to make accidental duplicate enqueueing easy to detect.

---

## 7. Media processing worker

**Required stack:** Python 3.14, `uv`, `yt-dlp`, FFmpeg/ffprobe, `google-cloud-firestore`, `google-cloud-storage`, Ruff, `ty`, pytest, Docker, Cloud Run Jobs.

This is a **Cloud Run Job**, not a Cloud Run Service.

Suggested layout:

```text
apps/worker/
├── pyproject.toml
├── uv.lock
├── Dockerfile
├── src/
│   └── garmin_audio_worker/
│       ├── main.py
│       ├── jobs.py
│       ├── firestore.py
│       ├── storage.py
│       ├── progress.py
│       └── sources/
│           ├── base.py
│           └── youtube.py
└── tests/
```

Keep source extraction behind an interface:

```python
class SourceResolver(Protocol):
    async def download(self, source: Source, output: Path) -> DownloadResult:
        ...
```

This matters because source-specific extraction is the brittle part of the system. The rest of the architecture should not care whether the bytes came from YouTube, a podcast feed, an upload, or somewhere else.

Only process material you're authorized to download.

### Worker sequence

```text
JOB_ID
  ↓
load job
  ↓
acquire Firestore lease
  ↓
source resolver / yt-dlp
  ↓
ffmpeg normalize
  ↓
ffprobe metadata
  ↓
SHA-256
  ↓
upload GCS
  ↓
Firestore transaction
    media = ready
    job = ready
    library revision++
  ↓
cleanup
```

Normalize to a predictable Garmin-friendly profile.

Music:

```text
MP3
128 kbps
44.1 kHz
stereo
```

Speech:

```text
MP3
96 kbps
44.1 kHz
stereo
```

You can increase music to 160 kbps later if Bluetooth listening makes a meaningful difference.

### Progress

Use FFmpeg's machine-readable progress output and update Firestore at most every ~10–15 seconds:

```text
downloading   38%
transcoding   71%
uploading
ready
```

Don't write progress several times per second.

---

## 8. Worker retry semantics

**Required stack:** Cloud Run Job retries, Firestore leases/state machine.

Cloud Run Jobs should initially use:

```text
tasks:          1
max retries:    2
task timeout:   2 hours
CPU:            2
memory:         4–8 GiB
```

Cloud Run supports up to 10 task retries and task timeouts up to 168 hours, so there is considerable room if you later handle very long media. ([Google Cloud][1])

The worker decides whether failures are retryable.

Transient:

```text
network timeout
YouTube/source 5xx
GCS temporary error
Google API unavailable
```

→ update error details and exit non-zero.

Permanent:

```text
unsupported URL
private/unavailable video
invalid input
source too large
no audio stream
```

→ mark job `failed`, `retryable=false`, then exit 0 so Cloud Run does not waste retries.

### Idempotency

Assume duplicate execution can happen.

At startup:

```text
transaction:
  if job.ready:
      exit success

  if active lease exists:
      exit success

  otherwise:
      acquire lease
```

Use deterministic object paths:

```text
media/{mediaId}/{sha256}.mp3
```

Never:

```text
media/random-file-394928.mp3
```

A retry should converge to the same result.

---

## 9. Private object storage

**Required stack:** Google Cloud Storage, uniform bucket-level access, public-access prevention, V4 signed URLs, IAM `signBlob`.

One private bucket:

```text
gs://garmin-audio-prod/
    media/
    temp/
```

Terraform should enable:

```text
uniform bucket-level access
public access prevention
versioning if desired
temp/ lifecycle deletion after 1 day
```

The bucket is never public.

The Garmin does **not** download through Vercel:

```text
BAD:

Garmin → Vercel → 100 MB MP3 → Garmin
```

Instead:

```text
Garmin → Vercel → authenticated feed
                     │
                     └─ signed GCS URL

Garmin ──────────────► GCS
```

Signed URLs should be GET-only, object-specific, and valid for roughly 1–2 hours. If one expires, the Garmin asks for a new feed.

Generate the signatures using Google IAM's signing capability rather than placing a signing private key on Vercel.

---

## 10. Garmin device authentication and pairing

**Required stack:** Next.js API, Web Crypto/Node crypto, Firestore, Connect IQ `Application.Storage`.

Do not use Basic Auth and do not implement OAuth on the Garmin.

Use a device-pairing protocol.

First launch:

```text
Garmin Audio

Pair device

Code:
482 931

Open:
audio.example.com/pair
```

Internally, the Garmin has a high-entropy pairing secret in addition to the six-digit human code.

Example:

```text
pairingId     random UUID
pairSecret    256 random bits
displayCode   482931
expires       10 minutes
```

The Garmin gets:

```json
{
  "pairingId": "...",
  "secret": "...",
  "code": "482931",
  "expiresIn": 600
}
```

You log into the Next.js UI using Google and enter `482931`.

The watch polls using both `pairingId` and the high-entropy secret. Once approved it receives:

```text
gdev_<256 random bits>
```

Subsequent calls:

```http
Authorization: Bearer gdev_xxxxxxxxx
```

Store the token itself only on the watch.

Firestore stores:

```text
SHA-256(deviceToken)
```

not the token.

Revocation means deleting/invalidating that hash.

---

## 11. Garmin application

**Required stack:** Connect IQ SDK 9.2.0, Monkey C, `Application.AudioContentProviderApp`, `Toybox.Media`, `Toybox.Communications`, `Application.Storage`, Run No Evil tests.

As of now, Connect IQ 9.2.0 is Garmin's latest SDK. Garmin's Audio Content Provider model is specifically intended to sync third-party media over Wi-Fi and integrate it with the native media player. ([Garmin Developers][5])

Structure:

```text
apps/garmin/
├── manifest.xml
├── monkey.jungle
├── resources/
│   ├── drawables/
│   ├── layouts/
│   └── strings/
└── source/
    ├── App.mc
    ├── PlaybackView.mc
    ├── PlaybackDelegate.mc
    ├── SyncDelegate.mc
    ├── ApiClient.mc
    ├── Pairing.mc
    ├── Library.mc
    └── Storage.mc
```

Implement:

```monkeyc
class App extends Application.AudioContentProviderApp
```

Garmin now recommends putting content download/sync actions inside **Playback Configuration**; its old separate Sync Configuration is deprecated. ([Garmin Developers][6])

Watch UI:

```text
My Audio

> Sync Library
  Play Downloads
  Library
  Storage
  Pair / Device
```

Sync algorithm:

```text
load local revision
      ↓
GET /api/garmin/feed?since=<revision>
      ↓
download upserts
      ↓
remove deletions
      ↓
commit ContentRefs
      ↓
store new revision
```

Don't try to run yt-dlp or understand YouTube on the watch. Its entire network contract should be:

```text
JSON metadata
+
ordinary MP3 URLs
```

---

## 12. Garmin feed protocol

**Required stack:** OpenAPI 3.1 contract, Zod validation, JSON, V4 signed URLs.

A typical response:

```json
{
  "revision": 184,
  "fullSync": false,
  "upserts": [
    {
      "id": "72b4...",
      "title": "Long Run Mix",
      "artist": "My Library",
      "durationSeconds": 3680,
      "bytes": 59218234,
      "sha256": "...",
      "downloadUrl": "https://storage.googleapis.com/..."
    }
  ],
  "deletes": [
    "11ad..."
  ]
}
```

If the Garmin revision is too old because tombstones were purged:

```json
{
  "revision": 184,
  "fullSync": true,
  "upserts": [...]
}
```

Keep deletion tombstones for, say, 30 days.

An item becomes part of the Garmin feed only when:

```text
status == ready
AND syncToGarmin == true
```

That lets your web library contain items that shouldn't occupy watch storage.

---

## 13. API contracts

**Required stack:** OpenAPI 3.1, Redocly CLI or equivalent schema linter, `openapi-typescript`, golden JSON fixtures.

Keep the shared protocol in:

```text
packages/contracts/
├── openapi.yaml
├── fixtures/
│   ├── feed-full.json
│   ├── feed-delta.json
│   └── pairing.json
└── generated/
    └── api.ts
```

The TypeScript client/types can be generated.

Monkey C types should stay hand-written because generating a large client for the Garmin is likely worse than maintaining a tiny DTO layer.

Add contract tests that feed exactly the same fixture into:

```text
Next.js response validation
Worker tests where relevant
Garmin JSON parser tests
```

This prevents subtle backend/watch protocol drift.

---

## 14. Terraform architecture

**Required stack:** Terraform, Google provider 7.x, Vercel provider 5.x, TFLint, Trivy, GCS remote state.

Current provider lines are Google 7.x and Vercel 5.x; pin compatible ranges in `required_providers` and commit the resulting `.terraform.lock.hcl`. ([Terraform Registry][7])

### Bootstrap root

`infra/bootstrap` should create only what Terraform itself needs:

```text
GCS Terraform state bucket
GitHub Actions WIF pool/provider
terraform-ci service account
minimum IAM
```

Then migrate Terraform state to:

```text
gs://garmin-audio-terraform-state/prod
```

Enable versioning and public-access prevention on the state bucket.

### Main production root

Terraform provisions:

```text
GCP APIs
├─ iamcredentials.googleapis.com
├─ sts.googleapis.com
├─ run.googleapis.com
├─ artifactregistry.googleapis.com
├─ cloudtasks.googleapis.com
├─ firestore.googleapis.com
├─ storage.googleapis.com
└─ monitoring.googleapis.com

Artifact Registry
Firestore
GCS media bucket
Cloud Tasks queue
Cloud Run media-worker Job

Service accounts
├─ vercel-runtime
├─ task-launcher
├─ media-worker
└─ gcs-url-signer

Vercel WIF pool/provider
IAM bindings

Vercel project
Vercel OIDC configuration
Production domain

Cloud Logging metrics
Monitoring alerts
```

Terraform can manage Vercel projects; the current Vercel provider is 5.14.0. The provider itself requires a Vercel management API token, so **IaC execution is the one place where a long-lived Vercel management credential may remain**. Keep it in a protected GitHub Environment or use it only from your local machine. Your production application runtime remains fully keyless. ([Terraform Registry][7])

Do not put:

```text
AUTH_SECRET
GOOGLE_CLIENT_SECRET
Garmin device tokens
service-account JSON
```

into Terraform.

---

## 15. IAM model

**Required stack:** Google IAM, WIF, dedicated service accounts, Terraform.

Keep identities purpose-specific.

### `vercel-runtime`

Needs:

```text
Firestore read/write to application data
Cloud Tasks enqueue
IAM signBlob against gcs-url-signer
```

### `task-launcher`

Needs only enough permission to invoke:

```text
media-worker:run
```

with execution overrides.

Cloud Tasks uses OAuth because it's calling a Google API endpoint; Google's Cloud Tasks documentation distinguishes access tokens for Google APIs from ID tokens commonly used for Cloud Run HTTP endpoints. ([Google Cloud Documentation][8])

### `media-worker`

Needs:

```text
Firestore read/write
GCS object read/write/delete within media bucket
```

### `gcs-url-signer`

Needs access appropriate for downloading the media object and the Vercel runtime gets only the signing permission needed to request signatures.

Never use project-wide Owner/Editor at runtime.

---

## 16. Pre-commit hooks

**Required stack:** Lefthook, Biome, TypeScript compiler, Ruff, `ty`, Monkey C compiler, Terraform, TFLint, Trivy.

I’d use **Lefthook at the repository root** rather than separate hook frameworks in each language.

Biome itself documents Lefthook as a supported fast cross-platform Git-hook setup and supports re-staging automatically fixed files. ([Biome][9])

A representative `lefthook.yml`:

```yaml
pre-commit:
  parallel: true

  commands:
    web-biome:
      glob: "apps/web/**/*.{js,jsx,ts,tsx,json,jsonc,css}"
      run: >
        pnpm exec biome check
        --write
        --no-errors-on-unmatched
        --files-ignore-unknown=true
        {staged_files}
      stage_fixed: true

    web-types:
      glob: "apps/web/**/*.{ts,tsx}"
      run: pnpm --dir apps/web typecheck

    contracts:
      glob: "packages/contracts/**/*.{json,yaml,yml,ts}"
      run: pnpm --dir packages/contracts check

    worker-ruff:
      glob: "apps/worker/**/*.py"
      run: >
        uv run --directory apps/worker ruff check --fix {staged_files}
        &&
        uv run --directory apps/worker ruff format {staged_files}
      stage_fixed: true

    worker-types:
      glob: "apps/worker/**/*.py"
      run: uv run --directory apps/worker ty check

    worker-lock:
      glob: "apps/worker/{pyproject.toml,uv.lock}"
      run: uv lock --directory apps/worker --check

    garmin-compile:
      glob: "apps/garmin/**/*.{mc,xml,jungle}"
      run: ./scripts/garmin-check.sh

    terraform-format:
      glob: "infra/**/*.tf"
      run: terraform fmt {staged_files}
      stage_fixed: true

    terraform-check:
      glob: "infra/**/*.{tf,hcl}"
      run: ./scripts/terraform-check.sh

pre-push:
  parallel: true

  commands:
    web-test:
      glob: "apps/web/**"
      run: pnpm --dir apps/web test

    worker-test:
      glob: "apps/worker/**"
      run: uv run --directory apps/worker pytest

    garmin-test:
      glob: "apps/garmin/**"
      run: ./scripts/garmin-test.sh
```

For Python, I’d deliberately use **Ruff + ty + uv**, not Black/isort/Flake8/mypy/pip-tools. `ty` is Astral's newer Rust type checker and has explicit pre-commit support. ([Astral Docs][10])

### `terraform-check.sh`

Run:

```text
terraform validate
tflint
trivy config
```

against each Terraform root/module.

Trivy supports Terraform HCL and Terraform-plan misconfiguration scanning, so it can cover IaC security checks rather than adding the older tfsec tool separately. ([GitHub][11])

---

## 17. Garmin pre-commit quality gate

**Required stack:** Garmin `monkeyc`, strict type checking, compiler warnings, Run No Evil.

There isn't a Biome/Ruff-quality formatter/linter ecosystem for Monkey C, so use Garmin's compiler as the hard quality gate.

`garmin-check.sh` should roughly perform:

```text
monkeyc
  strict type checking
  warnings enabled
  representative target device
```

The repository should define one canonical compile device:

```text
GARMIN_TEST_DEVICE=<your-watch-id>
```

and CI should compile all supported targets before release.

Unit tests should cover:

```text
pairing response parsing
device-token persistence
feed parsing
delta reconciliation
deletion reconciliation
revision persistence
failed-download recovery
```

Keep the Garmin app intentionally thin. That is a major reliability advantage.

---

## 18. CI/CD

**Required stack:** GitHub Actions, GitHub OIDC → GCP WIF, Docker BuildKit, Artifact Registry, Terraform, Vercel Git deployment, Trivy, Renovate.

### Pull request

Run:

```text
Biome
tsc
Vitest
worker Ruff
worker ty
pytest
Garmin strict compile
contract validation
terraform fmt
terraform validate
TFLint
Trivy
Terraform plan
Docker build
```

Terraform plan should authenticate to Google via **GitHub Actions OIDC/WIF**, not a GCP service-account key.

No production deployment from PRs.

### Main branch

Sequence:

```text
1. Run all checks.
2. Build media-worker container.
3. Trivy image scan.
4. Push image to Artifact Registry.
5. Capture immutable image digest.
6. terraform apply worker_image=<digest>.
7. Vercel deploys apps/web through Git integration.
8. Run post-deploy API smoke tests.
```

Do not deploy Cloud Run using `latest`.

Terraform should reference:

```text
region-docker.pkg.dev/project/repo/worker@sha256:...
```

so every deployed worker is reproducible.

### Dependency maintenance

Renovate should cover:

```text
pnpm packages
Docker base images
GitHub Actions
Terraform providers
uv/Python dependencies
```

Let Renovate make weekly PRs rather than auto-merging major releases.

---

## 19. Observability and recovery

**Required stack:** Firestore job state, Google Cloud Logging, Cloud Monitoring, Vercel logs.

For one user, don't add Datadog, Temporal or another operational platform.

Worker logs should be structured:

```json
{
  "severity": "INFO",
  "jobId": "...",
  "mediaId": "...",
  "phase": "transcoding",
  "message": "ffmpeg started"
}
```

Useful alerts:

```text
worker executions failing repeatedly
jobs processing with no heartbeat >30 min
Cloud Tasks retry exhaustion
GCS upload failures
```

The UI should expose enough information that you rarely need Cloud Console:

```text
Failed
Source unavailable
Attempt 3
Last error 10:44
[Retry]
```

Add a later reconciliation job, perhaps every 15 minutes:

```text
find:
  state = processing
  heartbeat < now - 30m
```

Then mark stale jobs failed or enqueue a fresh attempt.

This isn't necessary for the first vertical slice.

---

## 20. Source-security boundaries

**Required stack:** URL parser, explicit source adapters, worker sandbox/container restrictions.

Do **not** make the worker an arbitrary URL downloader.

Initially accept:

```text
https://youtube.com/...
https://www.youtube.com/...
https://youtu.be/...
```

and reject everything else.

That prevents your processing worker from becoming an SSRF primitive capable of reaching cloud metadata/internal endpoints.

Additional guards:

```text
https only
maximum duration
maximum expected output size
no arbitrary headers supplied by user
no user-supplied ffmpeg args
no user-supplied yt-dlp args
storage filenames generated from IDs
metadata strings sanitized
```

Keep browser → source URL validation and worker → source URL validation independently. Never trust the Firestore document merely because the web app created it.

---

## 21. Testing strategy

**Required stack:** Vitest, Playwright, pytest, Garmin Run No Evil, OpenAPI fixtures, Terraform test/validate.

The highest-value tests are boundaries.

### Web

Test:

```text
unauthorized Google user rejected
create media → job + Cloud Task
retry creates new attempt
pair claim requires human auth
Garmin bearer-token hash verification
feed never includes unfinished media
signed URL only generated for authorized device
```

### Worker

Test:

```text
invalid source is terminal
network error is retryable
duplicate execution is idempotent
existing ready job exits harmlessly
ffmpeg failure records useful error
successful processing increments revision once
```

Mock subprocess boundaries for most tests.

Have a small number of integration tests use actual FFmpeg against tiny fixture files.

### Garmin

Use fixed backend fixtures and test:

```text
full sync
incremental sync
deletion
expired URL recovery
failed download
revision remains unchanged after partial failure
device re-pair
```

### Terraform

Run:

```text
terraform fmt -check
terraform validate
terraform test
tflint
trivy config
```

in CI.

---

## 22. Implementation sequence

**Required stack:** the corresponding stack from each phase above.

I would build it in this order because it attacks the uncertain Garmin piece first rather than spending days polishing media ingestion.

| Phase  | Deliverable               | Exit criterion                                                 |
| ------ | ------------------------- | -------------------------------------------------------------- |
| **0**  | Repo/tooling              | `just check` passes locally and hooks are installed            |
| **1**  | Terraform foundation      | GCS, Firestore, IAM, WIF, Artifact Registry created            |
| **2**  | Next.js auth              | Only your Google `sub` can access UI                           |
| **3**  | Garmin pairing            | Watch pairs and authenticated `/feed` succeeds                 |
| **4**  | Static MP3 vertical slice | One pre-uploaded private GCS MP3 downloads and plays on Garmin |
| **5**  | Incremental library       | Add/remove media and Garmin delta sync works                   |
| **6**  | Cloud Run worker          | Local/test audio is transcoded and uploaded automatically      |
| **7**  | Cloud Tasks launch        | Creating a web item reliably launches worker job               |
| **8**  | Source adapter            | Authorized YouTube URL → MP3 → ready                           |
| **9**  | Retry/progress            | Failures, retries and progress visible in UI                   |
| **10** | Hardening                 | alerts, reconciliation, quotas, source limits                  |
| **11** | Polish                    | playlists, profiles, artwork, storage management               |

The key milestone is **Phase 4**:

```text
private GCS MP3
      ↓
authenticated Garmin feed
      ↓
signed URL
      ↓
watch Wi-Fi
      ↓
native Garmin playback
```

Until that works, I would not spend time making the YouTube ingestion path clever.

## Final stack

The resulting system is deliberately small:

| Layer              | Chosen stack                                           |
| ------------------ | ------------------------------------------------------ |
| **Web**            | Next.js 16.3.x + TypeScript + Node 24 + Vercel         |
| **Web quality**    | Biome + TypeScript + Vitest + Playwright               |
| **Human auth**     | Auth.js + Google OIDC + one allowed `sub`              |
| **Vercel → GCP**   | Vercel OIDC + Google WIF                               |
| **Database/state** | Firestore                                              |
| **Queue**          | Cloud Tasks                                            |
| **Compute**        | Cloud Run Jobs                                         |
| **Worker**         | Python 3.14 + uv + yt-dlp + FFmpeg                     |
| **Python quality** | Ruff + ty + pytest                                     |
| **Storage**        | private GCS + V4 signed URLs                           |
| **Garmin**         | Connect IQ 9.2 + Monkey C Audio Content Provider       |
| **Garmin auth**    | paired opaque bearer token, SHA-256 server-side        |
| **IaC**            | Terraform + Google 7.x + Vercel 5.x                    |
| **IaC quality**    | terraform validate/test + TFLint + Trivy               |
| **Hooks**          | Lefthook                                               |
| **CI/CD**          | GitHub Actions + OIDC/WIF + Artifact Registry + Vercel |
| **Dependencies**   | Renovate                                               |
| **Tool versions**  | mise + lockfiles                                       |

This gives you a system with **no public media, no Basic Auth, no GCP service-account keys, no ffmpeg execution inside Vercel, proper durable job handling, and one-button sync from the Garmin**.

[1]: https://cloud.google.com/run/docs/create-jobs?utm_source=chatgpt.com "Create jobs  |  Cloud Run  |  Google Cloud"
[2]: https://nodejs.org/en/download?utm_source=chatgpt.com "Node.js — Download Node.js®"
[3]: https://vercel.com/docs/oidc?utm_source=chatgpt.com "OpenID Connect (OIDC) Federation"
[4]: https://docs.cloud.google.com/run/docs/execute/jobs?hl=en&utm_source=chatgpt.com "Execute jobs  |  Cloud Run  |  Google Cloud Documentation"
[5]: https://developer.garmin.com/connect-iq/?utm_source=chatgpt.com "Connect IQ SDK | Garmin Developers"
[6]: https://developer.garmin.com/connect-iq/connect-iq-basics/app-types/?utm_source=chatgpt.com "Connect IQ Basics"
[7]: https://registry.terraform.io/providers/Vercel/vercel/latest?utm_source=chatgpt.com "vercel/vercel | Terraform Registry"
[8]: https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks?authuser=50&utm_source=chatgpt.com "Create HTTP target tasks programmatically  |  Cloud Tasks  |  Google Cloud Documentation"
[9]: https://next.biomejs.dev/recipes/git-hooks/?utm_source=chatgpt.com "Git Hooks | Biome"
[10]: https://docs.astral.sh/ty/reference/typing-faq/?utm_source=chatgpt.com "Typing FAQ | ty"
[11]: https://github.com/aquasecurity/trivy/blob/main/docs/guide/coverage/iac/terraform.md?utm_source=chatgpt.com "trivy/docs/guide/coverage/iac/terraform.md at main · aquasecurity/trivy · GitHub"
