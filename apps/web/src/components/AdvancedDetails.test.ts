import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AdvancedDetails from "./AdvancedDetails.svelte";

const props = {
  workerOrigin: "http://127.0.0.1:8787",
  sessionStatus: "Authenticated",
  localLibraryOwner: "dills122",
  localLibraryStatus: "720 repositories stored locally and ready to refresh.",
  observedFields: "full_name, starred_at",
};

describe("AdvancedDetails", () => {
  it("hides runtime diagnostics until the trigger is opened", async () => {
    const { container } = render(AdvancedDetails, props);
    const trigger = screen.getByRole("button", { name: "Runtime and diagnostics" });
    const content = container.querySelector(".advanced-details-grid");

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(content?.hasAttribute("hidden")).toBe(true);

    await fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(content?.hasAttribute("hidden")).toBe(false);
    expect(screen.getByText(props.workerOrigin)).toBeTruthy();
    expect(screen.getByText(props.localLibraryStatus)).toBeTruthy();
  });
});
