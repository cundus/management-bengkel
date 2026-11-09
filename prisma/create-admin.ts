/**
 * Membuat akun pemilik pertama untuk production tanpa memasukkan data demo.
 *
 * Pemakaian (dari mesin lokal yang punya akses ke database production):
 *   ADMIN_EMAIL=owner@wmc225.id ADMIN_NAME="Pemilik WMC 225" ADMIN_PASSWORD="..." pnpm db:create-admin
 *
 * Jangan commit password production ke repository.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Pemilik WMC 225";
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD minimal 8 karakter.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password!, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "owner" },
    create: { email: email!, name, passwordHash, role: "owner" },
  });

  const initialSettings: [string, string][] = [
    ["workshop_name", "WMC 225"],
    ["workshop_phone", ""],
    ["workshop_address", ""],
    ["workshop_tagline", "Servis tepat, harga jelas."],
    ["default_due_days", "14"],
    ["invoice_note", "Terima kasih sudah mempercayakan kendaraan Anda kepada WMC 225."],
  ];
  for (const [key, value] of initialSettings) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log(`Akun owner siap: ${user.email} (${user.name})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
