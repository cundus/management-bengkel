import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), compare: vi.fn(), session: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
vi.mock("@/lib/auth", () => ({ createSession: mocks.session, destroySession: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { loginAction } from "@/actions/auth";

const user = { id: 1, name: "Pemilik", email: "owner@example.com", username: "pemilik", role: "owner", passwordHash: "hash" };
function form(identifier: string, password = "password123", field = "identifier") {
  const data = new FormData();
  data.set(field, identifier);
  data.set("password", password);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(user);
  mocks.compare.mockResolvedValue(true);
});

describe("login dengan username atau email", () => {
  it.each([
    [" PEMILIK ", { username: "pemilik" }],
    [" OWNER@EXAMPLE.COM ", { email: "owner@example.com" }],
  ])("menormalkan identifier %s dan membuat sesi", async (identifier, where) => {
    await loginAction({ ok: false }, form(identifier));
    expect(mocks.findUnique).toHaveBeenCalledWith({ where });
    expect(mocks.session).toHaveBeenCalledWith({ id: 1, name: "Pemilik", email: "owner@example.com", role: "owner" }, "hash");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("tetap menerima field email dari form versi sebelumnya dan akun tanpa username", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, username: null });
    await loginAction({ ok: false }, form("owner@example.com", "password123", "email"));
    expect(mocks.session).toHaveBeenCalled();
  });

  it("mengembalikan pesan sama untuk username tidak ditemukan dan password salah", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const missing = await loginAction({ ok: false }, form("missing"));
    mocks.findUnique.mockResolvedValue(user);
    mocks.compare.mockResolvedValue(false);
    const invalid = await loginAction({ ok: false }, form("pemilik", "wrong"));
    expect(missing).toEqual(invalid);
    expect(mocks.compare).toHaveBeenCalledTimes(2);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("menolak identifier kosong", async () => {
    expect((await loginAction({ ok: false }, form("  "))).ok).toBe(false);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
