locals {
  security_enabled             = var.manage_security_controls
  security_allowed_country_set = "{${join(" ", [for country in var.security_allowed_countries : "\"${country}\""])}}"
  security_all_api_hostnames   = [for environment in local.environment_config : environment.api_hostname]
  security_api_host_set        = "{${join(" ", [for hostname in local.security_all_api_hostnames : "\"${hostname}\""])}}"
  staging_security_hostnames = [
    local.environment_config[var.staging_environment_name].web_hostname,
    local.environment_config[var.staging_environment_name].api_hostname,
  ]
  production_security_hostnames = [
    local.environment_config["production"].web_hostname,
    local.environment_config["production"].api_hostname,
  ]
  staging_security_host_set     = "{${join(" ", [for hostname in local.staging_security_hostnames : "\"${hostname}\""])}}"
  production_security_host_set  = "{${join(" ", [for hostname in local.production_security_hostnames : "\"${hostname}\""])}}"
  staging_access_hostnames      = distinct(concat([local.environment_config[var.staging_environment_name].web_hostname], tolist(var.staging_access_extra_hostnames)))
  staging_access_policy_enabled = var.manage_staging_access && length(var.staging_access_allowed_emails) > 0

  production_geo_expression      = "(http.host in ${local.production_security_host_set} and not ip.geoip.country in ${local.security_allowed_country_set})"
  staging_geo_expression         = "(http.host in ${local.staging_security_host_set} and not ip.geoip.country in ${local.security_allowed_country_set})"
  api_auth_rate_limit_expression = <<-EOT
    (http.host in ${local.security_api_host_set} and (starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/auth/")))
  EOT
}

resource "cloudflare_ruleset" "forage_firewall_custom" {
  count = local.security_enabled ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "${var.project_slug} hosted traffic controls"
  description = "Forage WAF controls for hosted web and API traffic."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      ref         = "forage_staging_geo_challenge"
      description = "Challenge non-primary-region traffic to staging web and API hosts."
      expression  = local.staging_geo_expression
      action      = var.security_geo_challenge_action
      enabled     = var.security_staging_geo_challenge_enabled
    },
    {
      ref         = "forage_hosted_geo_challenge"
      description = "Challenge non-primary-region traffic to production Forage web and API hosts."
      expression  = local.production_geo_expression
      action      = var.security_geo_challenge_action
      enabled     = var.security_production_geo_challenge_enabled
    },
  ]
}

resource "cloudflare_ruleset" "forage_rate_limits" {
  count = local.security_enabled ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "${var.project_slug} API rate limits"
  description = "Forage rate limits for hosted auth and API endpoints."
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [
    {
      ref         = "forage_api_auth_rate_limit"
      description = "Challenge clients that hit Forage API or GitHub auth endpoints too frequently."
      expression  = trimspace(local.api_auth_rate_limit_expression)
      action      = var.security_rate_limit_action
      enabled     = var.security_rate_limits_enabled
      ratelimit = {
        characteristics     = ["ip.src", "cf.colo.id"]
        period              = var.security_api_auth_rate_limit.period_seconds
        requests_per_period = var.security_api_auth_rate_limit.requests_per_period
        mitigation_timeout  = var.security_api_auth_rate_limit.mitigation_timeout_seconds
      }
    },
  ]
}

resource "cloudflare_zero_trust_access_policy" "staging_allowlist" {
  count = local.staging_access_policy_enabled ? 1 : 0

  account_id       = var.cloudflare_account_id
  name             = "${var.project_slug} staging tester allowlist"
  decision         = "allow"
  session_duration = var.staging_access_session_duration

  include = [
    for email in var.staging_access_allowed_emails : {
      email = {
        email = email
      }
    }
  ]
}

resource "cloudflare_zero_trust_access_application" "staging_web" {
  count = local.staging_access_policy_enabled ? 1 : 0

  account_id                 = var.cloudflare_account_id
  name                       = "${var.project_slug} staging web"
  domain                     = local.environment_config[var.staging_environment_name].web_hostname
  type                       = "self_hosted"
  app_launcher_visible       = false
  enable_binding_cookie      = true
  http_only_cookie_attribute = true
  same_site_cookie_attribute = var.staging_access_same_site_cookie_attribute
  session_duration           = var.staging_access_session_duration

  destinations = [
    for hostname in local.staging_access_hostnames : {
      type = "public"
      uri  = hostname
    }
  ]

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.staging_allowlist[0].id
      precedence = 1
    }
  ]
}
