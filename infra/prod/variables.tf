variable "project_id" {
  type        = string
  description = "Google Cloud project ID."
}

variable "region" {
  type        = string
  description = "Primary Google Cloud region."
  default     = "europe-west4"
}

variable "media_bucket_name" {
  type        = string
  description = "Globally unique private bucket name for media objects."
}

variable "firestore_location" {
  type        = string
  description = "Firestore database location."
  default     = "eur3"
}

variable "task_queue_name" {
  type        = string
  description = "Cloud Tasks queue used to launch media jobs."
  default     = "media-launch"
}

variable "cloud_run_job_name" {
  type        = string
  description = "Cloud Run Job name for media processing."
  default     = "media-worker"
}

variable "worker_image" {
  type        = string
  description = "Fully qualified worker container image."
}
