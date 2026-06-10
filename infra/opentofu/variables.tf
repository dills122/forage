variable "cloudflare_account_id" {
  description = "Cloudflare account id that owns Pages, Workers, Durable Objects, and KV."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone id for Forage custom domains."
  type        = string
}

variable "project_slug" {
  description = "Short stable project slug used in managed Cloudflare resource names."
  type        = string
  default     = "forage"
}

variable "pages_project_name" {
  description = "Cloudflare Pages project name for apps/web."
  type        = string
  default     = "forage-web"
}

variable "worker_service_name" {
  description = "Base Cloudflare Worker service name. Staging defaults to this name suffixed with the environment name."
  type        = string
  default     = "forage-worker"
}

variable "production_branch" {
  description = "Git branch Cloudflare Pages treats as production."
  type        = string
  default     = "main"
}

variable "preview_environment_name" {
  description = "Environment config used for Cloudflare Pages preview builds."
  type        = string
  default     = "staging"
}

variable "node_version" {
  description = "Node.js version used by Cloudflare Pages builds."
  type        = string
  default     = "22"
}

variable "github_api_version" {
  description = "GitHub REST API version passed to the Worker."
  type        = string
  default     = "2022-11-28"
}

variable "manage_pages_project" {
  description = "Whether OpenTofu should create and configure the Cloudflare Pages project."
  type        = bool
  default     = true
}

variable "manage_pages_domains" {
  description = "Whether OpenTofu should attach custom domains to the Pages project."
  type        = bool
  default     = true
}

variable "manage_worker_custom_domains" {
  description = "Whether OpenTofu should attach custom domains to deployed Worker services."
  type        = bool
  default     = false
}

variable "environments" {
  description = "Hosted environment topology. Keep repository data out of all server-side resources."
  type = map(object({
    web_hostname                = string
    api_hostname                = string
    github_redirect_uri         = optional(string)
    worker_service_name         = optional(string)
    settings_kv_title           = optional(string)
    create_settings_kv          = optional(bool, true)
    manage_pages_domain         = optional(bool, true)
    manage_worker_custom_domain = optional(bool, true)
  }))

  default = {
    staging = {
      web_hostname                = "staging.forage.example.com"
      api_hostname                = "api-staging.forage.example.com"
      create_settings_kv          = true
      manage_pages_domain         = true
      manage_worker_custom_domain = true
    }
    production = {
      web_hostname                = "forage.example.com"
      api_hostname                = "api.forage.example.com"
      create_settings_kv          = true
      manage_pages_domain         = true
      manage_worker_custom_domain = true
      worker_service_name         = "forage-worker"
    }
  }

  validation {
    condition     = contains(keys(var.environments), "production")
    error_message = "The environments map must include a production environment."
  }

  validation {
    condition     = contains(keys(var.environments), var.preview_environment_name)
    error_message = "preview_environment_name must match a key in environments."
  }
}
