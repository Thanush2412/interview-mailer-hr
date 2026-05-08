"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { Suspense } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    handleGoogleCredential?: (response: { credential: string }) => void;
  }
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError]     = useState(params.get("error") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { setError("Google Client ID not configured."); return; }

    window.handleGoogleCredential = async (response: { credential: string }) => {
      setLoading(true); setError("");
      try {
        const res  = await fetch("/api/auth/google-signin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (data.status === "ok") {
          // Poll /api/auth/me until the session cookie is confirmed committed, then navigate
          let attempts = 0;
          const verify = async () => {
            attempts++;
            try {
              const check = await fetch("/api/auth/me");
              const me    = await check.json();
              if (me.status === "ok") { window.location.replace("/"); return; }
            } catch {}
            if (attempts < 15) setTimeout(verify, 200);
            else { setError("Session could not be confirmed. Please try again."); setLoading(false); }
          };
          setTimeout(verify, 150);
        } else if (data.status === "unauthorized") {
          setError(`${data.email || "Your account"} is not authorised to access this system.`);
        } else {
          setError(data.message || "Sign-in failed. Please try again.");
        }
      } catch { setError("Network error. Please try again."); }
      finally { setLoading(false); }
    };

    function init() {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback:  window.handleGoogleCredential,
        ux_mode:   "popup",
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline", size: "large", width: 320,
        text: "signin_with", shape: "rectangular", logo_alignment: "left",
      });
    }

    if (window.google) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.onload = init;
    document.head.appendChild(s);

    return () => { delete window.handleGoogleCredential; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-10 text-center">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4 shadow-lg">
              <CalendarCheck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">FACE Prep</h1>
            <p className="text-blue-100 text-sm mt-1">Interview Mailer</p>
          </div>
          <div className="px-8 py-8 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700">Welcome back</p>
              <p className="text-xs text-slate-400">Sign in with your authorised Google account to continue.</p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
                {error}
              </div>
            )}
            <div className="flex justify-center min-h-[44px] items-center">
              {loading
                ? <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />Signing in…
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
  return <Suspense><LoginContent /></Suspense>;
}
