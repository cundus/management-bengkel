"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
        <Download size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-extrabold text-brand-dark">Pasang WMC 225 di layar utama</p>
        <p className="text-[9.5px] font-medium text-brand-dark/65">Akses lebih cepat seperti aplikasi native.</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
        className="btn-primary btn-sm shrink-0"
      >
        Pasang
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-brand-dark/40 hover:text-brand-dark"
        aria-label="Tutup"
      >
        <X size={14} />
      </button>
    </div>
  );
}
