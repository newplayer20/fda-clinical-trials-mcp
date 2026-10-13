import { connection, NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { paymentChallenge, QUERY_PRICE, recipientAddress, resourceServer, BASE_NETWORK } from "@/lib/x402";
import { queryNicheData } from "@/lib/niche-data";

const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Accept, Content-Type, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "Access-Control-Max-Age": "86400",
};

const MAX_QUERY_LENGTH = 200;

function applyCors(headers: Headers) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
}

function jsonResponse(body: unknown, status: number, extra?: Headers) {
  const headers = new Headers(extra);
  applyCors(headers);
  return NextResponse.json(body, { status, headers });
}

/**
 * Keep protocol headers and attach CORS so browser-based agents can read a 402.
 * Non-browser agents receive the same JSON body.
 */
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

  return NextResponse.json(paymentChallenge(headers.get("payment-required")), {
    status: 402,
    statusText: "Payment Required",
    headers,
  });
}

async function readQuery(request: NextRequest): Promise<string | null> {
  const fromUrl = request.nextUrl.searchParams.get("q");
  if (fromUrl?.trim()) return fromUrl.trim();

  if (request.method === "GET" || request.method === "HEAD") return null;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const body = (await request.json()) as { q?: unknown };
    return typeof body.q === "string" && body.q.trim() ? body.q.trim() : null;
  } catch {
    return null;
  }
}

async function queryHandler(request: NextRequest): Promise<NextResponse> {
  const q = await readQuery(request);
  if (!q) {
    return NextResponse.json(
      { error: "missing_query", hint: "Pass q as a query parameter or JSON field." },
      { status: 400 },
    );
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "query_too_long", max: MAX_QUERY_LENGTH },
      { status: 400 },
    );
  }

  return NextResponse.json(queryNicheData(q));
}

// withX402 reads PAYMENT-SIGNATURE, verifies it with the x402 facilitator,
// and settles only after this handler returns a status below 400.
const protectedHandler = withX402(
  queryHandler,
  {
    accepts: {
      scheme: "exact",
      price: QUERY_PRICE,
      network: BASE_NETWORK,
      payTo: () => recipientAddress(),
    },
    description: "Token-optimized niche data query. Compact JSON, no HTML.",
    mimeType: "application/json",
  },
  resourceServer,
);

async function paid(request: NextRequest) {
  await connection();
  try {
    recipientAddress();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment recipient is not configured";
    return jsonResponse({ error: "payment_recipient_unconfigured", message }, 500);
  }

  try {
    return await finalize(await protectedHandler(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return jsonResponse({ error: "request_failed", message }, 500);
  }
}

export function OPTIONS() {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Allow", "GET, POST, OPTIONS");
  return new NextResponse(null, { status: 204, headers });
}

export function GET(request: NextRequest) {
  return paid(request);
}

export function POST(request: NextRequest) {
  return paid(request);
}
