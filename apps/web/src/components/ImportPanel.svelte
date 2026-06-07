<script lang="ts">
  import type { ApplicationSettings } from "@forage/shared";
  import { Download, FileSpreadsheet, RefreshCw, Trash2, X } from "@lucide/svelte";
  import AdvancedDetails from "./AdvancedDetails.svelte";

  interface Props {
    configStatus: string;
    progress: string;
    importRunning: boolean;
    authenticated: boolean;
    localLibraryConflict: boolean;
    repositoryCount: number;
    settings: ApplicationSettings;
    settingsStatus: string;
    workerOrigin: string;
    sessionStatus: string;
    localLibraryOwner: string;
    localLibraryStatus: string;
    observedFields: string;
    onImport: () => void;
    onCancelImport: () => void;
    onExport: (format: "json" | "csv") => void;
    onReset: () => void;
    onDeleteAccount: () => void;
    onAnalyticsChange: (enabled: boolean) => void;
  }

  let {
    configStatus,
    progress,
    importRunning,
    authenticated,
    localLibraryConflict,
    repositoryCount,
    settings,
    settingsStatus,
    workerOrigin,
    sessionStatus,
    localLibraryOwner,
    localLibraryStatus,
    observedFields,
    onImport,
    onCancelImport,
    onExport,
    onReset,
    onDeleteAccount,
    onAnalyticsChange,
  }: Props = $props();
</script>

<section class="panel import-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">Import</p>
      <h2>Refresh your starred repository library.</h2>
    </div>
    <span id="config-status" class="status-pill">{configStatus}</span>
  </div>
  <p id="progress-text" class="progress-text">{progress}</p>
  <div class="actions">
    <button
      id="import-button"
      class="button"
      type="button"
      disabled={importRunning || !authenticated || localLibraryConflict}
      onclick={onImport}
    >
      <RefreshCw size={16} aria-hidden="true" />
      Import Stars
    </button>
    {#if importRunning}
      <button
        id="cancel-import-button"
        class="button secondary"
        type="button"
        onclick={onCancelImport}
      >
        <X size={16} aria-hidden="true" />
        Cancel Import
      </button>
    {/if}
    <button
      id="export-button"
      class="button secondary"
      type="button"
      disabled={importRunning || repositoryCount === 0}
      onclick={() => onExport("json")}
    >
      <Download size={16} aria-hidden="true" />
      Export JSON
    </button>
    <button
      id="export-csv-button"
      class="button secondary"
      type="button"
      disabled={importRunning || repositoryCount === 0}
      onclick={() => onExport("csv")}
    >
      <FileSpreadsheet size={16} aria-hidden="true" />
      Export CSV
    </button>
    <button
      id="reset-button"
      class="button danger"
      type="button"
      disabled={importRunning || repositoryCount === 0}
      onclick={onReset}
    >
      <Trash2 size={16} aria-hidden="true" />
      Reset Local Data
    </button>
  </div>

  <div class="settings-row">
    <label class="setting-toggle">
      <input
        id="analytics-toggle"
        type="checkbox"
        checked={settings.analytics_enabled}
        disabled={!authenticated}
        onchange={(event) => onAnalyticsChange(event.currentTarget.checked)}
      />
      <span>
        <strong>Share anonymous product analytics</strong>
        <small id="analytics-status">{settingsStatus}</small>
      </span>
    </label>
    <button
      id="delete-account-button"
      class="button secondary"
      type="button"
      disabled={!authenticated || importRunning}
      onclick={onDeleteAccount}
    >
      <Trash2 size={16} aria-hidden="true" />
      Delete Server State
    </button>
  </div>

  <AdvancedDetails
    {workerOrigin}
    {sessionStatus}
    {localLibraryOwner}
    {localLibraryStatus}
    {observedFields}
  />
</section>
