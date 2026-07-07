"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type GsiCredentialResponse = { credential: string };
type Gsi = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GsiCredentialResponse) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: Gsi;
  }
}

/**
 * The Google Identity Services button. When no client ID is configured, a
 * development-only fallback lets you sign in with just a name (the API route
 * behind it is disabled in production).
 */
export default function GoogleSignIn({ clientId }: { clientId: string | null }) {
  const buttonHost = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [devName, setDevName] = useState("");
  const router = useRouter();

  const finishSignIn = useCallback(
    async (endpoint: string, payload: Record<string, string>) => {
      setError(null);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        router.refresh();
      } else {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Sign-in failed.");
      }
    },
    [router],
  );

  const initGsi = useCallback(() => {
    if (!clientId || !window.google || !buttonHost.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => void finishSignIn("/api/auth/google", response),
    });
    window.google.accounts.id.renderButton(buttonHost.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
    });
  }, [clientId, finishSignIn]);

  return (
    <div className="signin">
      {clientId ? (
        <>
          <Script src="https://accounts.google.com/gsi/client" onLoad={initGsi} />
          <div ref={buttonHost} />
        </>
      ) : (
        <form
          className="signin-dev"
          onSubmit={(event) => {
            event.preventDefault();
            if (devName.trim()) void finishSignIn("/api/auth/dev", { name: devName.trim() });
          }}
        >
          <p className="signin-note">
            Google sign-in isn&apos;t configured (set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>).
            While developing, sign in with just a name:
          </p>
          <div className="signin-dev-row">
            <input
              className="stand-input"
              placeholder="Your name"
              value={devName}
              onChange={(event) => setDevName(event.target.value)}
            />
            <button className="btn" type="submit" disabled={!devName.trim()}>
              Enter the study
            </button>
          </div>
        </form>
      )}
      {error && <p className="signin-error">{error}</p>}
    </div>
  );
}
