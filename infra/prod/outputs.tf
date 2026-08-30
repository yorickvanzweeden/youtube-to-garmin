output "media_bucket_name" {
  value       = google_storage_bucket.media.name
  description = "Private bucket used for media objects."
}

output "web_runtime_service_account" {
  value       = google_service_account.web_runtime.email
  description = "Service account for the Vercel runtime identity federation."
}

output "worker_service_account" {
  value       = google_service_account.worker.email
  description = "Service account for the Cloud Run media worker."
}
