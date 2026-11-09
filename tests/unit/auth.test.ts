import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ token: "", set: vi.fn(), user: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.token }), set: mocks.set }) }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.user } } }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
import { createSession, getCurrentUser } from "@/lib/auth";

const user = { id: 1, name: "Pemilik", email: "owner@example.com", role: "owner" as const };
beforeEach(async () => {
  vi.clearAllMocks();
  await createSession(user, "old-hash");
  mocks.token = mocks.set.mock.calls[0][1];
  mocks.user.mockResolvedValue({ ...user, passwordHash: "old-hash" });
});

it("membaca role terbaru dari database tanpa membocorkan hash", async () => {
  mocks.user.mockResolvedValue({ ...user, role: "kasir", passwordHash: "old-hash" });
  expect(await getCurrentUser()).toEqual({ ...user, role: "kasir" });
});

it("mengakhiri sesi lama setelah kata sandi diganti", async () => {
  mocks.user.mockResolvedValue({ ...user, passwordHash: "new-hash" });
  expect(await getCurrentUser()).toBeNull();
});

it("menolak token sesi yang dimodifikasi", async () => {
  mocks.token = `${mocks.token.slice(0, -5)}xxxxx`;
  expect(await getCurrentUser()).toBeNull();
});
