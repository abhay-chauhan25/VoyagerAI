import { act, fireEvent, render, screen } from "@testing-library/react";
import { CardPhoto } from "@/components/drift/card-photo";

const props = {
  src: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg",
  alt: "Example Square",
  sizes: "10rem",
  fallback: <span>No photo</span>,
};

describe("a place's photo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the photo when it loads", () => {
    render(<CardPhoto {...props} />);
    expect(screen.getByAltText("Example Square")).toBeInTheDocument();
    expect(screen.queryByText("No photo")).not.toBeInTheDocument();
  });

  it("asks once more after a failure, and keeps the photo if that works", () => {
    render(<CardPhoto {...props} />);
    const first = screen.getByAltText("Example Square");
    fireEvent.error(first);
    act(() => vi.advanceTimersByTime(1500));
    const second = screen.getByAltText("Example Square");
    expect(second).not.toBe(first);
    expect(screen.queryByText("No photo")).not.toBeInTheDocument();
  });

  it("shows the no-photo face instead of a broken picture when it fails twice", () => {
    render(<CardPhoto {...props} />);
    fireEvent.error(screen.getByAltText("Example Square"));
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.error(screen.getByAltText("Example Square"));
    expect(screen.getByText("No photo")).toBeInTheDocument();
    expect(screen.queryByAltText("Example Square")).not.toBeInTheDocument();
  });
});
