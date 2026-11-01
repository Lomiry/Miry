// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CertificateOption from "./CertificateOption";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Fixture() {
  const [a, setA] = useState(false),
    [b, setB] = useState(false);
  return (
    <>
      <section aria-label="First">
        <CertificateOption value={a} onChange={setA} />
      </section>
      <section aria-label="Second">
        <CertificateOption value={b} onChange={setB} />
      </section>
    </>
  );
}
it("defaults off, requires confirmation, and keeps SSL opt-out confined to the selected route", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  render(<Fixture />);
  const [a, b] = screen.getAllByRole("checkbox");
  expect(a).toHaveProperty("checked", false);
  expect(b).toHaveProperty("checked", false);
  await user.click(a.closest("label")!);
  expect(a).toHaveProperty("checked", false);
  confirm.mockReturnValue(true);
  await user.click(a.closest("label")!);
  expect(a).toHaveProperty("checked", true);
  expect(b).toHaveProperty("checked", false);
  expect(document.querySelector(".certificate-warning")).toBeTruthy();
  await user.click(a);
  expect(a).toHaveProperty("checked", false);
  expect(confirm).toHaveBeenCalledTimes(2);
});
