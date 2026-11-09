"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { initialActionState } from "@/lib/action-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
          <label htmlFor="identifier" className="label">
            Username atau email
          </label>
          <div className="relative">
            <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="username atau nama@bengkel.id"
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

    </>
  );
}
