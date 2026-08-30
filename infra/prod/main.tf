locals {
  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudtasks.googleapis.com",
    "firestore.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each           = local.required_services
  service            = each.value
  disable_on_destroy = false
}

resource "google_firestore_database" "default" {
  project                 = var.project_id
  name                    = "(default)"
  location_id             = var.firestore_location
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_ENABLED"

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "media" {
  name                        = var.media_bucket_name
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition {
      age            = 1
      matches_prefix = ["temp/"]
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository" "media" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "Container images for the Garmin media worker."
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "web_runtime" {
  account_id   = "garmin-web-runtime"
  display_name = "Garmin Audio web runtime"
  project      = var.project_id
}

resource "google_service_account" "worker" {
  account_id   = "garmin-media-worker"
  display_name = "Garmin Audio media worker"
  project      = var.project_id
}

resource "google_iam_workload_identity_pool" "vercel" {
  project                   = var.project_id
  workload_identity_pool_id = "vercel"
  display_name              = "Vercel deployments"
  description               = "Keyless identity federation for the production Vercel project."
  disabled                  = false
}

resource "google_iam_workload_identity_pool_provider" "vercel" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.vercel.workload_identity_pool_id
  workload_identity_pool_provider_id = "vercel"
  display_name                       = "Vercel OIDC"
  description                        = "Trust only production tokens from the configured Vercel project."

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.owner"       = "assertion.owner"
    "attribute.project"     = "assertion.project"
    "attribute.environment" = "assertion.environment"
  }

  attribute_condition = "assertion.owner == '${var.vercel_team_slug}' && assertion.project == '${var.vercel_project_name}' && assertion.environment == 'production'"

  oidc {
    issuer_uri = "https://oidc.vercel.com/${var.vercel_team_slug}"
  }
}

resource "google_service_account_iam_member" "vercel_runtime" {
  service_account_id = google_service_account.web_runtime.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.vercel.name}/attribute.project/${var.vercel_project_name}"
}

resource "google_cloud_tasks_queue" "media_launch" {
  name     = var.task_queue_name
  project  = var.project_id
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
  }

  retry_config {
    max_attempts       = 5
    max_retry_duration = "1800s"
    min_backoff        = "5s"
    max_backoff        = "300s"
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_job" "media_worker" {
  name     = var.cloud_run_job_name
  project  = var.project_id
  location = var.region

  template {
    task_count = 1

    template {
      service_account = google_service_account.worker.email
      max_retries     = 2
      timeout         = "7200s"

      containers {
        image = var.worker_image

        env {
          name  = "GCS_MEDIA_BUCKET"
          value = google_storage_bucket.media.name
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_job_iam_member" "task_runner" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.media_worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.web_runtime.email}"
}

resource "google_project_iam_member" "web_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.web_runtime.email}"
}

resource "google_storage_bucket_iam_member" "worker_media" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}
