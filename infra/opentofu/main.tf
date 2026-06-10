terraform {
  required_version = ">= 1.8.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.9.0"
    }
  }
}

provider "cloudflare" {}

locals {
  environment_config = {
    for name, environment in var.environments : name => merge(environment, {
      github_redirect_uri = coalesce(
        environment.github_redirect_uri,
        "https://${environment.api_hostname}/auth/github/callback",
      )
      settings_kv_title = coalesce(
        environment.settings_kv_title,
        "${var.project_slug}-${name}-settings",
      )
      worker_service_name = coalesce(
        environment.worker_service_name,
        name == "production" ? var.worker_service_name : "${var.worker_service_name}-${name}",
      )
    })
  }

  pages_environment_variables = {
    for name, environment in local.environment_config : name => {
      NODE_VERSION         = var.node_version
      PUBLIC_WORKER_ORIGIN = "https://${environment.api_hostname}"
    }
  }

  worker_environment_variables = {
    for name, environment in local.environment_config : name => {
      ENVIRONMENT         = name
      GITHUB_API_VERSION  = var.github_api_version
      GITHUB_REDIRECT_URI = environment.github_redirect_uri
      WEB_ORIGIN          = "https://${environment.web_hostname}"
      SETTINGS_KV_ID      = try(cloudflare_workers_kv_namespace.settings[name].id, null)
    }
  }
}

resource "cloudflare_workers_kv_namespace" "settings" {
  for_each = {
    for name, environment in local.environment_config : name => environment
    if environment.create_settings_kv
  }

  account_id = var.cloudflare_account_id
  title      = each.value.settings_kv_title
}

resource "cloudflare_pages_project" "web" {
  count = var.manage_pages_project ? 1 : 0

  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = var.production_branch

  build_config = {
    build_caching   = true
    build_command   = "pnpm --filter @forage/web build"
    destination_dir = "apps/web/dist"
    root_dir        = "/"
  }

  deployment_configs = {
    preview = {
      env_vars = {
        NODE_VERSION = {
          type  = "plain_text"
          value = var.node_version
        }
        PUBLIC_WORKER_ORIGIN = {
          type  = "plain_text"
          value = "https://${local.environment_config[var.preview_environment_name].api_hostname}"
        }
      }
      fail_open = false
    }
    production = {
      env_vars = {
        NODE_VERSION = {
          type  = "plain_text"
          value = var.node_version
        }
        PUBLIC_WORKER_ORIGIN = {
          type  = "plain_text"
          value = "https://${local.environment_config["production"].api_hostname}"
        }
      }
      fail_open = false
    }
  }
}

resource "cloudflare_pages_domain" "web" {
  for_each = {
    for name, environment in local.environment_config : name => environment
    if var.manage_pages_domains && environment.manage_pages_domain
  }

  account_id   = var.cloudflare_account_id
  project_name = var.pages_project_name
  name         = each.value.web_hostname

  depends_on = [cloudflare_pages_project.web]
}

resource "cloudflare_dns_record" "pages_web" {
  for_each = {
    for name, environment in local.environment_config : name => environment
    if var.manage_pages_domains && environment.manage_pages_domain
  }

  zone_id = var.cloudflare_zone_id
  name    = each.value.web_hostname
  type    = "CNAME"
  content = each.key == "production" ? "${var.pages_project_name}.pages.dev" : "${each.key}.${var.pages_project_name}.pages.dev"
  proxied = true
  ttl     = 1
  comment = "Forage ${each.key} Pages custom domain"

  depends_on = [cloudflare_pages_domain.web]
}

resource "cloudflare_workers_custom_domain" "api" {
  for_each = {
    for name, environment in local.environment_config : name => environment
    if var.manage_worker_custom_domains && environment.manage_worker_custom_domain
  }

  account_id  = var.cloudflare_account_id
  environment = "production"
  hostname    = each.value.api_hostname
  service     = each.value.worker_service_name
  zone_id     = var.cloudflare_zone_id
}
