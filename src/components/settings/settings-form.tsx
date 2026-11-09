"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { updateSettingsAction } from "@/actions/finance";
import { initialActionState } from "@/lib/action-state";

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, action, pending] = useActionState(updateSettingsAction, initialActionState);

  return (
    <form action={action} className="space-y-4">
      {state.message && (
        <div
          className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-[11px] font-semibold ${
            state.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          {state.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          {state.message}
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="workshop-name" className="label">
            Nama bengkel
          </label>
          <input
            id="workshop-name"
            name="workshopName"
            defaultValue={settings.workshop_name}
            required
            className="input"
          />
        </div>
        <div>
          <label htmlFor="workshop-phone" className="label">
            Nomor telepon
          </label>
          <input
            id="workshop-phone"
            name="workshopPhone"
            defaultValue={settings.workshop_phone}
            className="input"
            inputMode="tel"
          />
        </div>
        <div>
          <label htmlFor="workshop-tagline" className="label">
            Tagline
          </label>
          <input
            id="workshop-tagline"
            name="workshopTagline"
            defaultValue={settings.workshop_tagline}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="workshop-address" className="label">
            Alamat
          </label>
          <input
            id="workshop-address"
            name="workshopAddress"
            defaultValue={settings.workshop_address}
            className="input"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="invoice-note" className="label">
            Catatan di nota
          </label>
          <textarea
            id="invoice-note"
            name="invoiceNote"
            defaultValue={settings.invoice_note}
            className="textarea"
            rows={3}
          />
          <p className="mt-1.5 text-[9.5px] text-faint">Tampil di bagian bawah nota transaksi.</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? (
            <>
              <LoaderCircle size={14} className="animate-spin" /> Menyimpan…
            </>
          ) : (
            <>
              <Save size={14} /> Simpan pengaturan
            </>
          )}
        </button>
      </div>
    </form>
  );
}
