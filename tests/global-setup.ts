import fs from "node:fs";
import { execSync } from "node:child_process";

export default function setup() {
  if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const testUrl =
    process.env.TEST_DATABASE_URL ||
    "postgresql://wmc:wmc@localhost:5432/wmc225_test?schema=public";
  const env = { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl };

  try {
    execSync("pnpm prisma migrate reset --force --skip-seed --skip-generate", { env, stdio: "inherit" });
    execSync("pnpm tsx prisma/seed.ts", { env, stdio: "inherit" });
  } catch {
    throw new Error(
      "Gagal menyiapkan database test PostgreSQL. Jalankan `docker compose up -d` lalu ulangi `pnpm test`.",
    );
  }
}
