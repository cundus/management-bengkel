import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  hash: vi.fn(),
  revalidate: vi.fn(),
  user: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireOwner: mocks.owner }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));
import { saveAccountAction } from "@/actions/accounts";

function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Kasir Baru", email: " KASIR@EXAMPLE.COM ", username: " KASIR.BARU ", role: "kasir", password: "password123", ...overrides })) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue({ id: 1, role: "owner" });
  mocks.hash.mockResolvedValue("hashed-password");
  mocks.user.findUnique.mockResolvedValue({ id: 1, role: "owner" });
  mocks.user.count.mockResolvedValue(1);
  mocks.transaction.mockImplementation((callback) => callback({ user: mocks.user }));
});

describe("manajemen akun", () => {
  it("menolak pemanggil tanpa akses pemilik sebelum menulis data", async () => {
    mocks.owner.mockRejectedValue(new Error("forbidden"));
    await expect(saveAccountAction({ ok: false }, form())).rejects.toThrow("forbidden");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("membuat akun dengan email normal dan hash kata sandi", async () => {
    expect((await saveAccountAction({ ok: false }, form())).ok).toBe(true);
    expect(mocks.user.create).toHaveBeenCalledWith({ data: { name: "Kasir Baru", email: "kasir@example.com", username: "kasir.baru", role: "kasir", passwordHash: "hashed-password" } });
    expect(mocks.hash).toHaveBeenCalledWith("password123", 12);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it.each([{ role: "admin" }, { password: "short" }, { password: "é".repeat(37) }, { email: "invalid" }, { id: "abc" }])("menolak input tidak valid %j", async (overrides) => {
    expect((await saveAccountAction({ ok: false }, form(overrides))).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("mencegah penurunan role pemilik terakhir", async () => {
    const result = await saveAccountAction({ ok: false }, form({ id: "1", password: "" }));
    expect(result.message).toContain("Pemilik terakhir");
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("mengizinkan perubahan role jika masih ada pemilik lain tanpa mengganti password kosong", async () => {
    mocks.user.count.mockResolvedValue(2);
    expect((await saveAccountAction({ ok: false }, form({ id: "1", password: "" }))).ok).toBe(true);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "kasir", passwordHash: undefined }) }));
  });

  it("menolak jika pemilik kehilangan role sebelum transaksi berjalan", async () => {
    mocks.user.findUnique.mockResolvedValue({ id: 1, role: "kasir" });
    expect((await saveAccountAction({ ok: false }, form())).ok).toBe(false);
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it("menangani email duplikat", async () => {
    mocks.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }));
    expect((await saveAccountAction({ ok: false }, form())).message).toContain("Email sudah digunakan");
  });

  it("menangani username duplikat tanpa menyimpan perubahan", async () => {
    mocks.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6", meta: { target: ["username"] } }));
    expect((await saveAccountAction({ ok: false }, form())).message).toContain("Username sudah digunakan");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each(["ab", "a".repeat(31), "user@example.com", "user name", "_user", "pengguna!"])("menolak username tidak valid %s", async (username) => {
    expect((await saveAccountAction({ ok: false }, form({ username }))).ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("mengizinkan akun tanpa username untuk kompatibilitas email", async () => {
    expect((await saveAccountAction({ ok: false }, form({ username: "" }))).ok).toBe(true);
    expect(mocks.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ username: null }) }));
  });

  it("meminta pengulangan bila transaksi bersamaan mengalami konflik", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "6" }));
    expect((await saveAccountAction({ ok: false }, form())).message).toContain("coba lagi");
  });
});
