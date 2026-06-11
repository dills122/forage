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

variable "pages_compatibility_date" {
  description = "Cloudflare Pages compatibility date preserved in preview and production deployment configs."
  type        = string
  default     = "2026-06-10"
}

variable "pages_compatibility_flags" {
  description = "Cloudflare Pages compatibility flags preserved in preview and production deployment configs."
  type        = list(string)
  default     = []
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

variable "manage_security_controls" {
  description = "Whether OpenTofu should manage Cloudflare WAF and rate limiting rules for hosted Forage domains."
  type        = bool
  default     = false
}

variable "manage_staging_access" {
  description = "Whether OpenTofu should manage a Cloudflare Access application for the staging web hostname."
  type        = bool
  default     = false
}

variable "staging_environment_name" {
  description = "Environment key protected by Cloudflare Access for hosted staging."
  type        = string
  default     = "staging"
}

variable "staging_access_allowed_emails" {
  description = "Email addresses allowed through the staging Cloudflare Access application. Required when manage_staging_access is true."
  type        = set(string)
  default     = []
}

variable "staging_access_extra_hostnames" {
  description = "Additional staging hostnames protected by the same Access app, such as a Pages preview branch hostname."
  type        = set(string)
  default     = []
}

variable "staging_access_session_duration" {
  description = "Cloudflare Access session duration for staging web access."
  type        = string
  default     = "8h"
}

variable "staging_access_same_site_cookie_attribute" {
  description = "SameSite attribute for Cloudflare Access staging cookies. Lax avoids losing Access cookies during OAuth redirect chains."
  type        = string
  default     = "lax"

  validation {
    condition     = contains(["lax", "strict", "none"], var.staging_access_same_site_cookie_attribute)
    error_message = "staging_access_same_site_cookie_attribute must be lax, strict, or none."
  }
}

variable "security_allowed_countries" {
  description = "Country codes treated as primary expected traffic sources for hosted Forage domains."
  type        = set(string)
  default     = ["US", "CA"]

  validation {
    condition     = length(var.security_allowed_countries) > 0 && alltrue([for country in var.security_allowed_countries : can(regex("^[A-Z]{2}$", country))])
    error_message = "security_allowed_countries must contain one or more uppercase ISO 3166-1 alpha-2 country codes."
  }
}

variable "security_geo_challenge_action" {
  description = "WAF action used for traffic outside security_allowed_countries."
  type        = string
  default     = "managed_challenge"

  validation {
    condition     = contains(["managed_challenge", "js_challenge", "challenge", "block"], var.security_geo_challenge_action)
    error_message = "security_geo_challenge_action must be one of managed_challenge, js_challenge, challenge, or block."
  }
}

variable "security_rate_limit_action" {
  description = "WAF action used when hosted API or auth rate limits are exceeded."
  type        = string
  default     = "block"

  validation {
    condition     = contains(["block", "managed_challenge", "js_challenge", "challenge"], var.security_rate_limit_action)
    error_message = "security_rate_limit_action must be one of block, managed_challenge, js_challenge, or challenge."
  }
}

variable "security_staging_geo_challenge_enabled" {
  description = "Whether the staging geo challenge WAF rule is enabled."
  type        = bool
  default     = true
}

variable "security_production_geo_challenge_enabled" {
  description = "Whether the production geo challenge WAF rule is enabled."
  type        = bool
  default     = true
}

variable "security_rate_limits_enabled" {
  description = "Whether API and auth rate limiting rules are enabled."
  type        = bool
  default     = true
}

variable "security_api_auth_rate_limit" {
  description = "Combined rate limit threshold for hosted /auth/* and /api/* endpoints. Some Cloudflare plans allow only one http_ratelimit rule per zone."
  type = object({
    period_seconds             = number
    requests_per_period        = number
    mitigation_timeout_seconds = number
  })
  default = {
    period_seconds             = 10
    requests_per_period        = 20
    mitigation_timeout_seconds = 10
  }
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

  validation {
    condition     = contains(keys(var.environments), var.staging_environment_name)
    error_message = "staging_environment_name must match a key in environments."
  }
}
