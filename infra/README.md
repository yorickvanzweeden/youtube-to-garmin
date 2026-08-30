# Terraform

Terraform roots and modules are intentionally placeholders for Phase 1. Keep bootstrap state and production infrastructure in separate roots, and commit provider lock files once providers are initialized.
## Production foundation

`prod/` provisions the non-secret Google Cloud foundation: required APIs, a
private GCS media bucket, the Firestore Native database, and separate runtime
service accounts for the web app and media worker.

```sh
cd infra/prod
terraform init
terraform plan -var-file=terraform.tfvars
```

Copy `terraform.tfvars.example` to a local `terraform.tfvars`; it is ignored by
Git. OAuth, Vercel, and other secret values must be supplied through encrypted
environment configuration, never Terraform variables.
