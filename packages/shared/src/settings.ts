export interface ApplicationSettings {
  analytics_enabled: boolean;
  updated_at: string | null;
}

export type ApplicationSettingsUpdate = Pick<ApplicationSettings, "analytics_enabled">;
