"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Bike, LoaderCircle, UserRound } from "lucide-react";
import { createCustomerAction } from "@/actions/customers";
import { initialActionState } from "@/lib/action-state";
import Link from "next/link";

export function CustomerForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCustomerAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-4">
        {state.message && !state.ok && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-[12px] font-semibold text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {state.message}
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg bg-pine text-lime">
              <UserRound size={14} />
            </span>
            <div>
              <h2 className="text-[13px] font-extrabold text-ink">Data pelanggan</h2>
              <p className="text-[10px] font-medium text-faint">Informasi dasar untuk menghubungi pelanggan.</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="label">
                Nama lengkap <span className="text-brand">*</span>
              </label>
              <input id="name" name="name" required placeholder="Contoh: Andi Pratama" className="input" />
              {state.fieldErrors?.name && <p className="mt-1 text-[10px] font-semibold text-danger">{state.fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Nomor WhatsApp
              </label>
              <input id="phone" name="phone" inputMode="tel" placeholder="0812-3456-7890" className="input" />
            </div>
            <div>
              <label htmlFor="address" className="label">
                Alamat
              </label>
              <input id="address" name="address" placeholder="Alamat pelanggan" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className="label">
                Catatan pelanggan
              </label>
              <textarea id="notes" name="notes" placeholder="Preferensi servis, info tambahan…" className="textarea" rows={2} />
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Bike size={14} />
            </span>
            <div>
              <h2 className="text-[13px] font-extrabold text-ink">Kendaraan pertama</h2>
              <p className="text-[10px] font-medium text-faint">Kendaraan bisa ditambah lagi nanti dari profil.</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label htmlFor="plateNumber" className="label">
                Nomor polisi <span className="text-brand">*</span>
              </label>
              <input
                id="plateNumber"
                name="plateNumber"
                required
                placeholder="D 1234 ABC"
                className="input font-mono font-bold uppercase tracking-wider"
              />
              {state.fieldErrors?.plateNumber && (
                <p className="mt-1 text-[10px] font-semibold text-danger">{state.fieldErrors.plateNumber}</p>
              )}
            </div>
            <div>
              <label htmlFor="brand" className="label">
                Merek <span className="text-brand">*</span>
              </label>
              <input id="brand" name="brand" required placeholder="Honda / Yamaha / Toyota" className="input" />
              {state.fieldErrors?.brand && <p className="mt-1 text-[10px] font-semibold text-danger">{state.fieldErrors.brand}</p>}
            </div>
            <div>
              <label htmlFor="model" className="label">
                Model <span className="text-brand">*</span>
              </label>
              <input id="model" name="model" required placeholder="Beat / NMAX / Avanza" className="input" />
              {state.fieldErrors?.model && <p className="mt-1 text-[10px] font-semibold text-danger">{state.fieldErrors.model}</p>}
            </div>
            <div>
              <label htmlFor="year" className="label">
                Tahun
              </label>
              <input id="year" name="year" inputMode="numeric" placeholder="2020" className="input" />
              {state.fieldErrors?.year && <p className="mt-1 text-[10px] font-semibold text-danger">{state.fieldErrors.year}</p>}
            </div>
            <div>
              <label htmlFor="color" className="label">
                Warna
              </label>
              <input id="color" name="color" placeholder="Hitam" className="input" />
            </div>
            <div>
              <label htmlFor="odometer" className="label">
                Odometer (km)
              </label>
              <input id="odometer" name="odometer" inputMode="numeric" placeholder="42.000" className="input" />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" disabled={pending} className="btn-primary h-11 flex-1 sm:flex-none sm:px-8">
            {pending ? (
              <>
                <LoaderCircle size={15} className="animate-spin" /> Menyimpan…
              </>
            ) : (
              "Simpan pelanggan"
            )}
          </button>
          <Link href={next || "/pelanggan"} className="btn-secondary h-11">
            <ArrowLeft size={15} /> Batal
          </Link>
        </div>
      </div>

      <aside className="hidden space-y-3 rounded-2xl border border-line bg-surface/60 p-4 lg:block">
        <div className="eyebrow">Kenapa perlu?</div>
        <p className="text-[11px] leading-relaxed text-muted">
          Profil pelanggan membuat riwayat servis mudah dicari, memudahkan pengingat WhatsApp, dan menjaga piutang
          tetap terkait ke orang yang tepat.
        </p>
        <div className="rounded-xl bg-[#faf7f1] p-3">
          <div className="text-[10px] font-extrabold text-ink">Satu pelanggan, banyak kendaraan</div>
          <p className="mt-1 text-[10px] leading-relaxed text-faint">
            Setelah tersimpan, kamu bisa menambahkan kendaraan lain dari halaman profil pelanggan.
          </p>
        </div>
      </aside>
    </form>
  );
}
