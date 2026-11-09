const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const envPath = path.resolve(".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const e2eUrl =
  process.env.E2E_DATABASE_URL ||
  "postgresql://wmc:wmc@localhost:5432/wmc225_e2e?schema=public";
const env = { ...process.env, DATABASE_URL: e2eUrl, DIRECT_URL: e2eUrl };

fs.rmSync(path.resolve("playwright/.auth/user.json"), { force: true });
fs.mkdirSync(path.resolve("playwright/.auth"), { recursive: true });

console.log("Menyiapkan database E2E PostgreSQL...");
execSync("pnpm prisma migrate reset --force --skip-seed --skip-generate", { env, stdio: "inherit" });
execSync("pnpm tsx prisma/seed.ts", { env, stdio: "inherit" });
console.log("Database E2E siap. Menjalankan Playwright...");
