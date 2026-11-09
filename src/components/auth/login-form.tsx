"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

const DEMO_ACCOUNTS = [
  { role: "Pemilik", email: "owner@wmc225.id", name: "Budi", initials: "BS" },
  { role: "Kasir", email: "kasir@wmc225.id", name: "Sari", initials: "SW" },
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("wmc225");
    setSelectedDemo(demoEmail);
  }

  return (
    <>
      <form action={formAction} className="space-y-4">
        {state.message && !state.ok && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/15 bg-danger-soft px-3.5 py-3 text-[13px] font-semibold text-danger"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {state.message}
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <div className="relative">
            <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@bengkel.id"
              className="input h-[50px] pl-10"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">
              Kata sandi
            </label>
            <span className="mb-1.5 text-[10px] font-semibold text-faint">Minimal 8 karakter</span>
          </div>
          <div className="relative">
            <LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi"
              className="input h-[50px] pl-10 pr-11"
            />
            <button
              type="button"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-faint transition hover:bg-black/[0.04] hover:text-ink"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={pending} className="btn-primary h-[50px] w-full text-[14px]">
          {pending ? (
            <>
              <LoaderCircle size={17} className="animate-spin" />
              Memeriksa akses…
            </>
          ) : (
            <>
              Masuk ke dashboard
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-faint">Akun demo</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            type="button"
            key={account.email}
            onClick={() => fillDemo(account.email)}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl border bg-surface p-2.5 text-left transition-all hover:border-brand/40 hover:bg-brand-soft/40",
              selectedDemo === account.email ? "border-brand ring-4 ring-brand/10" : "border-line",
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f2eee6] font-display text-[10px] font-extrabold text-ink">
              {account.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink">
                <UserRound size={11} />
                {account.role}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium text-faint">{account.email}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[10px] font-medium text-faint">
        Kata sandi demo: <span className="font-mono font-bold text-muted">wmc225</span>
      </p>
    </>
  );
}
