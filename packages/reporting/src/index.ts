export type ExportFormat = "json" | "csv" | "markdown" | "html";

export interface ExportPlan {
  mvp_formats: ExportFormat[];
  include_versions: true;
}

export const exportPlan: ExportPlan = {
  mvp_formats: ["json", "csv"],
  include_versions: true,
};
