import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";

/** Base mainnet. CAIP-2 network id is `eip155:8453`. */
export const BASE_CHAIN_ID = 8453;
export const BASE_NETWORK = "eip155:8453" as const;
export const QUERY_PRICE = "$0.05";
export const QUERY_CURRENCY = "USDC";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * x402.org only settles testnet (Base Sepolia). Base mainnet `eip155:8453`
 * needs a facilitator that advertises the exact scheme on that network.
 * Override with X402_FACILITATOR_URL (for example the CDP facilitator).
 */
const facilitatorUrl =
  process.env.X402_FACILITATOR_URL?.trim() ||
  "https://facilitator.payai.network";

export const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: facilitatorUrl }),
).register(BASE_NETWORK, new ExactEvmScheme());

export function recipientAddress(): `0x${string}` {
  const configuredChain = process.env.NETWORK_CHAIN_ID?.trim();
  if (configuredChain && configuredChain !== String(BASE_CHAIN_ID)) {
    throw new Error(`NETWORK_CHAIN_ID must be ${BASE_CHAIN_ID} (Base)`);
  }

  const address = process.env.PAYMENT_RECIPIENT_ADDRESS?.trim();
  if (!address || !EVM_ADDRESS.test(address)) {
    throw new Error(
      "PAYMENT_RECIPIENT_ADDRESS must be a 0x-prefixed 20-byte address",
    );
  }
  return address as `0x${string}`;
}

export type PaymentChallenge = {
  error?: string;
  x402Version?: number;
  price: typeof QUERY_PRICE;
  currency: typeof QUERY_CURRENCY;
  payTo: string;
  network: typeof BASE_NETWORK;
  chainId: typeof BASE_CHAIN_ID;
  accepts?: unknown;
  resource?: unknown;
  extensions?: unknown;
};

/**
 * JSON body for a 402. The protocol challenge stays in `PAYMENT-REQUIRED`;
 * this copy lets clients that only read the body see the same requirement.
 */
export function paymentChallenge(encodedHeader: string | null): PaymentChallenge {
  const summary = {
    price: QUERY_PRICE,
    currency: QUERY_CURRENCY,
    payTo: recipientAddress(),
    network: BASE_NETWORK,
    chainId: BASE_CHAIN_ID,
  } as const;

  if (!encodedHeader) {
    return { error: "payment_required", ...summary };
  }

  try {
    const required = decodePaymentRequiredHeader(encodedHeader);
    return {
      error: required.error,
      x402Version: required.x402Version,
      accepts: required.accepts,
      resource: required.resource,
      extensions: required.extensions,
      ...summary,
    };
  } catch {
    return { error: "payment_required", ...summary };
  }
}
