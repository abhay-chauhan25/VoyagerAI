import { render, screen } from "@testing-library/react";
import { TextField } from "@/components/ui/text-field";

describe("TextField", () => {
  it("ties the label, hint and error to the input", () => {
    render(
      <TextField
        label="Password"
        name="password"
        hint="At least 8 characters."
        error="Too short."
      />,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("At least 8 characters. Too short.");
  });

  it("is not marked invalid without an error", () => {
    render(<TextField label="Email" name="email" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });
});
