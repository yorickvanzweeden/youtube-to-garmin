locals {
  required_services = toset([
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
