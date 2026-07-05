import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewModeToggle } from "@/components/ViewModeToggle";

describe("ViewModeToggle", () => {
  it("emits the selected view mode", () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="teacher" onChange={onChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /学生版/ }));

    expect(onChange).toHaveBeenCalledWith("student");
  });
});
