output "settings_kv_namespaces" {
  description = "KV namespace ids to bind as SETTINGS_KV in apps/worker/wrangler.toml or Worker deployment automation."
  value = {
    for name, namespace in cloudflare_workers_kv_namespace.settings : name => {
      title = namespace.title
      id    = namespace.id
    }
  }
}

output "pages_environment_variables" {
  description = "Plain-text Cloudflare Pages environment variables per environment."
  value       = local.pages_environment_variables
}

output "worker_environment_variables" {
  description = "Plain-text Cloudflare Worker environment variables per environment. SETTINGS_KV_ID is an output reference, not a secret."
  value       = local.worker_environment_variables
}

output "github_app_urls" {
  description = "Values to copy into GitHub App settings for each environment."
  value = {
    for name, environment in local.environment_config : name => {
      homepage_url = "https://${environment.web_hostname}"
      callback_url = environment.github_redirect_uri
    }
  }
}

output "required_worker_secret_names" {
  description = "Secret names that must be configured outside OpenTofu state."
  value = [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "SETTINGS_HASH_SALT",
    "SESSION_ENCRYPTION_KEY",
  ]
}

output "worker_custom_domains" {
  description = "Worker API domains managed by this configuration when manage_worker_custom_domains is true."
  value = {
    for name, domain in cloudflare_workers_custom_domain.api : name => {
      hostname = domain.hostname
      service  = domain.service
      id       = domain.id
    }
  }
}

output "pages_custom_domains" {
  description = "Pages web domains managed by this configuration."
  value = {
    for name, domain in cloudflare_pages_domain.web : name => {
      hostname = domain.name
      status   = domain.status
    }
  }
}

output "security_controls" {
  description = "Cloudflare security controls managed by this configuration."
  value = {
    waf_ruleset_id        = try(cloudflare_ruleset.forage_firewall_custom[0].id, null)
    rate_limit_ruleset_id = try(cloudflare_ruleset.forage_rate_limits[0].id, null)
    staging_access_app = try({
      id        = cloudflare_zero_trust_access_application.staging_web[0].id
      domain    = cloudflare_zero_trust_access_application.staging_web[0].domain
      hostnames = local.staging_access_hostnames
    }, null)
  }
}
