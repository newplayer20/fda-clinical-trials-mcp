import { connection, NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withX402 } from "@x402/next";
import { BASE_NETWORK, QUERY_PRICE, recipientAddress, resourceServer } from "@/lib/x402";

const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Accept, Authorization, Content-Type, PAYMENT-SIGNATURE, X-PAYMENT-SIGNATURE, X-PAYMENT, PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "Access-Control-Max-Age": "86400",
};

const SECRET_KEY_FIELDS = new Set(["key", "api_key", "token", "secret"]);

function applyCors(headers: Headers) {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
}

function jsonResponse(body: unknown, status: number, statusText?: string) {
  const headers = new Headers();
  applyCors(headers);
  return NextResponse.json(body, { status, statusText, headers });
}

function supabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerApiKey(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const token = match?.[1];
  if (!token?.startsWith("sk_")) return null;
  return token;
}

function paymentRequiredBody() {
  return {
    error: "Payment or API Key Required",
    x402: {
      price_usd: 0.05,
      asset: "USDC",
      network: "Base (Chain 8453)",
      recipient: process.env.PAYMENT_RECIPIENT_ADDRESS ?? "",
    },
    subscription: {
      info: "Get an unlimited API key for $199/mo at https://yourdomain.com/dashboard",
    },
  };
}

function keyMetadata(row: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(row)) {
    if (!SECRET_KEY_FIELDS.has(field)) metadata[field] = value;
  }
  return metadata;
}

async function activeApiKey(token: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseClient()
    .from("api_keys")
    .select("*")
    .eq("key", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as Record<string, unknown> | null;
  if (!row || row.status !== "active") return null;
  return row;
}

async function latestFdaRecords(): Promise<unknown[]> {
  const { data, error } = await supabaseClient()
    .from("fda_records")
    .select("*")
    .order("last_updated", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

function requestWithPaymentSignature(request: NextRequest): NextRequest {
  if (request.headers.get("payment-signature")) return request;
  const alternate =
    request.headers.get("x-payment-signature") ?? request.headers.get("x-payment");
  if (!alternate) return request;

  const headers = new Headers(request.headers);
  headers.set("PAYMENT-SIGNATURE", alternate);
  return new NextRequest(request.url, { method: request.method, headers });
}

async function recordsHandler(): Promise<NextResponse> {
  const data = await latestFdaRecords();
  return NextResponse.json({ data });
}

const protectedHandler = withX402(
  recordsHandler,
  {
    accepts: {
      scheme: "exact",
      price: QUERY_PRICE,
      network: BASE_NETWORK,
      payTo: () => recipientAddress(),
    },
    description: "Latest 20 FDA tracker records.",
    mimeType: "application/json",
  },
  resourceServer,
);

async function finalize(response: NextResponse) {
  const headers = new Headers(response.headers);
  applyCors(headers);

  if (response.status !== 402) {
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  await response.text();
  headers.delete("content-length");
  headers.delete("content-type");
  headers.delete("transfer-encoding");
  return NextResponse.json(paymentRequiredBody(), {
    status: 402,
    statusText: "Payment Required",
    headers,
  });
}

export function OPTIONS() {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Allow", "GET, OPTIONS");
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  await connection();

  try {
    const token = bearerApiKey(request);
    if (token) {
      const key = await activeApiKey(token);
      if (key) {
        const data = await latestFdaRecords();
        return jsonResponse({ key: keyMetadata(key), data }, 200);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "API key lookup failed";
    return jsonResponse({ error: "request_failed", message }, 500);
  }

  try {
    recipientAddress();
    return await finalize(await protectedHandler(requestWithPaymentSignature(request)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return jsonResponse({ error: "request_failed", message }, 500);
  }
}
