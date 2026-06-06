<script lang="ts">
  import { Collapsible } from "bits-ui";
  import { ChevronDown } from "@lucide/svelte";

  interface Props {
    workerOrigin: string;
    sessionStatus: string;
    localLibraryOwner: string;
    localLibraryStatus: string;
    observedFields: string;
  }

  let {
    workerOrigin,
    sessionStatus,
    localLibraryOwner,
    localLibraryStatus,
    observedFields,
  }: Props = $props();

  let open = $state(false);
</script>

<Collapsible.Root class="advanced-details" {open} onOpenChange={(nextOpen) => (open = nextOpen)}>
  <Collapsible.Trigger class="advanced-details-trigger">
    <span>Runtime and diagnostics</span>
    <ChevronDown size={16} aria-hidden="true" class={open ? "rotated" : ""} />
  </Collapsible.Trigger>
  <Collapsible.Content class="advanced-details-grid">
    <div>
      <p class="section-kicker">Connection</p>
      <dl class="detail-list compact">
        <dt>Worker</dt>
        <dd id="worker-origin">{workerOrigin}</dd>
        <dt>Session</dt>
        <dd id="session-status">{sessionStatus}</dd>
        <dt>Local owner</dt>
        <dd id="local-owner">{localLibraryOwner}</dd>
      </dl>
    </div>
    <div>
      <p class="section-kicker">Diagnostics</p>
      <dl class="detail-list compact">
        <dt>Repository data</dt>
        <dd id="repository-storage-status">{localLibraryStatus}</dd>
        <dt>Server storage</dt>
        <dd>Auth, session, settings, preferences only</dd>
        <dt>Observed fields</dt>
        <dd id="observed-fields">{observedFields}</dd>
      </dl>
    </div>
  </Collapsible.Content>
</Collapsible.Root>
