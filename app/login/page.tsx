"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { Suspense } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function LoginContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const btnRef       = useRef<HTMLDivElement>(null);
  const [error, setError]     = useState(params.get("error") || "");
  const [loading, setLoading] = useState(false);

  const errorMessages: Record<string, string> = {
    unauthorized: params.get("email")
      ? `${params.get("email")} is not authorised to access this system.`
      : "Your Google account is not authorised to access this system.",
    failed: "Sign-in failed. Please try again.",
  };

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    function initGoogle() {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback:  handleCredential,
        ux_mode:   "popup",
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme:     "outline",
        size:      "large",
        width:     320,
        text:      "signin_with",
        shape:     "rectangular",
        logo_alignment: "left",
      });
    }

    // Load GSI script if not already loaded
    if (window.google) {
      initGoogle();
    } else {
      const script    = document.createElement("script");
      script.src      = "https://accounts.google.com/gsi/client";
      script.async    = true;
      script.defer    = true;
      script.onload   = initGoogle;
      document.head.appendChild(script);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCredential(response: { credential: string }) {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth/google-signin", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        router.push("/");
        router.refresh();
      } else if (data.status === "unauthorized") {
        setError(`${data.email || "Your account"} is not authorised to access this system.`);
      } else {
        setError(data.message || "Sign-in failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">

          {/* Header — matches app branding */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-10 text-center">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4 shadow-lg">
              <CalendarCheck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">FACE Prep</h1>
            <p className="text-blue-100 text-sm mt-1">Interview Mailer</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700">Welcome back</p>
              <p className="text-xs text-slate-400">
                Sign in with your authorised Google account to continue.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
                {errorMessages[error] ?? error}
              </div>
            )}

            {/* Google Sign-In button rendered by GSI */}
            <div className="flex justify-center min-h-[44px] items-center">
              {loading
                ? <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </div>
                : <div ref={btnRef} />
              }
            </div>

            <p className="text-center text-xs text-slate-400">
              Access restricted to authorised FACE Prep staff only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
