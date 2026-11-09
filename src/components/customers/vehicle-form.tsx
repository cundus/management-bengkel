"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, Plus } from "lucide-react";
import { addVehicleAction } from "@/actions/customers";
import { initialActionState } from "@/lib/action-state";

export function VehicleForm({ customerId }: { customerId: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(addVehicleAction, initialActionState);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <details className="group mt-4 rounded-xl border border-line bg-[#fbf9f4]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-[10.5px] font-extrabold text-muted transition hover:text-ink">
        <Plus size={13} className="text-brand" />
        Tambah kendaraan
        <span className="ml-auto text-[9px] font-semibold text-faint group-open:hidden">Klik untuk buka</span>
      </summary>
      <form ref={formRef} action={action} className="border-t border-line p-3.5">
        <input type="hidden" name="customerId" value={customerId} />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2">
            <label htmlFor="new-plate" className="mb-1 block text-[9px] font-bold text-muted">
              Nomor polisi *
            </label>
            <input
              id="new-plate"
              name="plateNumber"
              required
              placeholder="D 1234 ABC"
              className="input h-9 font-mono text-[11px] font-bold uppercase"
            />
          </div>
          <div>
            <label htmlFor="new-brand" className="mb-1 block text-[9px] font-bold text-muted">
              Merek *
            </label>
            <input id="new-brand" name="brand" required placeholder="Honda" className="input h-9 text-[11px]" />
          </div>
          <div>
            <label htmlFor="new-model" className="mb-1 block text-[9px] font-bold text-muted">
              Model *
            </label>
            <input id="new-model" name="model" required placeholder="Beat" className="input h-9 text-[11px]" />
          </div>
          <div>
            <label htmlFor="new-year" className="mb-1 block text-[9px] font-bold text-muted">
              Tahun
            </label>
            <input id="new-year" name="year" inputMode="numeric" placeholder="2020" className="input h-9 text-[11px]" />
          </div>
          <div>
            <label htmlFor="new-odometer" className="mb-1 block text-[9px] font-bold text-muted">
              Odometer
            </label>
            <input id="new-odometer" name="odometer" inputMode="numeric" placeholder="km" className="input h-9 text-[11px]" />
          </div>
        </div>
        {state.message && (
          <div
            className={`mt-2 flex items-start gap-1.5 text-[10px] font-semibold ${
              state.ok ? "text-success" : "text-danger"
            }`}
          >
            {!state.ok && <AlertCircle size={11} className="mt-0.5 shrink-0" />}
            {state.message}
          </div>
        )}
        <button type="submit" disabled={pending} className="btn-primary mt-2.5 w-full btn-sm">
          {pending ? <LoaderCircle size={12} className="animate-spin" /> : <Plus size={12} />}
          Simpan kendaraan
        </button>
      </form>
    </details>
  );
}
