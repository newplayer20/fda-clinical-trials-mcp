"use client";

import { useState } from "react";

const FEATURES = [
  "Unlimited API key for your agents",
  "Latest clinical trial and FDA records",
  "Compact JSON, ready for model context",
];

export default function PricingCard() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/stripe/create-checkout", {
        method: "POST",
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        throw new Error(body.error ?? "Unable to start checkout");
      }
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start checkout");
      setPending(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
        Subscription
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Clinical Trial & FDA Data API
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Token-optimized trial and FDA records for AI agents, billed monthly.
      </p>
      <p className="mt-8 flex items-end gap-2">
        <span className="text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          $199
        </span>
        <span className="pb-1 text-sm text-zinc-500 dark:text-zinc-400">/month</span>
      </p>
      <ul className="mt-8 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-950 dark:text-zinc-50">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={subscribe}
        disabled={pending}
        aria-busy={pending}
        className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {pending ? "Opening Stripe…" : "Subscribe via Stripe"}
      </button>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
