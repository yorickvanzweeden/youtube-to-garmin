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
