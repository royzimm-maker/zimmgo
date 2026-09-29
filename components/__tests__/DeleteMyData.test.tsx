import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteMyData, clearZimmGoLocalStorage } from "@/components/DeleteMyData";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("zimmgo-trip", "{}");
  localStorage.setItem("zimmgo-pending-generation", "{}");
  localStorage.setItem("zimmgo_recent_destinations", "[]");
  localStorage.setItem("unrelated-site-key", "keep me");
});
afterEach(() => vi.unstubAllGlobals());

describe("clearZimmGoLocalStorage", () => {
  it("removes every ZimmGo key and nothing else", () => {
    clearZimmGoLocalStorage();
    expect(Object.keys(localStorage)).toEqual(["unrelated-site-key"]);
  });
});

describe("DeleteMyData", () => {
  it("asks for confirmation before deleting anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DeleteMyData />);

    await user.click(screen.getByRole("button", { name: "Delete my trips and data" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("can't be undone");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete my trips and data" })).toBeInTheDocument();
    expect(localStorage.getItem("zimmgo-trip")).toBe("{}");
  });

  it("deletes the server copy, then this browser's", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DeleteMyData />);

    await user.click(screen.getByRole("button", { name: "Delete my trips and data" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete everything" }));

    await waitFor(() => expect(localStorage.getItem("zimmgo-trip")).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/trip-sync", { method: "DELETE" });
    expect(localStorage.getItem("unrelated-site-key")).toBe("keep me");
  });

  it("leaves everything in place and says so if the server delete fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const user = userEvent.setup();
    render(<DeleteMyData />);

    await user.click(screen.getByRole("button", { name: "Delete my trips and data" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete everything" }));

    expect(await screen.findByText(/nothing was removed/)).toBeInTheDocument();
    expect(localStorage.getItem("zimmgo-trip")).toBe("{}");
  });
});
