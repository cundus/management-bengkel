import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, "Username harus 3–30 karakter: huruf, angka, titik, garis bawah, atau tanda hubung; diawali huruf atau angka.");
