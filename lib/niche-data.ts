const MARKUP = /<[^>]*>/g;

export type NicheItem = {
  id: string;
  t: string;
  s: string;
  tags: string[];
};

export type NicheQueryResult = {
  q: string;
  n: number;
  items: NicheItem[];
};

/**
 * Pre-parsed reference cards. Plain text only, short keys, no markup.
 * Replace this catalog with the niche source the API should serve.
 */
const CATALOG: readonly NicheItem[] = [
  {
    id: "base",
    t: "Base",
    s: "OP Stack L2. Chain id 8453. CAIP-2 network eip155:8453.",
    tags: ["base", "l2", "evm"],
  },
  {
    id: "base-usdc",
    t: "USDC on Base",
    s: "Native USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. 6 decimals. Supports EIP-3009.",
    tags: ["base", "usdc", "stablecoin"],
  },
  {
    id: "ethereum",
    t: "Ethereum",
    s: "Chain id 1. CAIP-2 network eip155:1. USDC 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.",
    tags: ["ethereum", "l1", "usdc"],
  },
  {
    id: "eip-3009",
    t: "EIP-3009",
    s: "TransferWithAuthorization. Off-chain signature moves a fixed token amount. No prior approve call.",
    tags: ["eip-3009", "usdc", "signature"],
  },
  {
    id: "x402",
    t: "x402",
    s: "HTTP 402 payment protocol. Unpaid calls return PAYMENT-REQUIRED. Paid retries send PAYMENT-SIGNATURE.",
    tags: ["x402", "http", "agents"],
  },
  {
    id: "caip-2",
    t: "CAIP-2",
    s: "Chain id format namespace:reference. EVM chains use eip155. Base mainnet is eip155:8453.",
    tags: ["caip-2", "base", "network"],
  },
];

function plain(value: string): string {
  return value.replace(MARKUP, "").replace(/\s+/g, " ").trim();
}

function toItem(record: NicheItem): NicheItem | null {
  const item: NicheItem = {
    id: plain(record.id),
    t: plain(record.t),
    s: plain(record.s),
    tags: record.tags.map(plain).filter(Boolean),
  };
  if (!item.id || !item.t || !item.s) return null;
  return item;
}

/** Match every whitespace-separated term against id, title, summary, and tags. */
export function queryNicheData(q: string): NicheQueryResult {
  const query = plain(q);
  const terms = query.toLowerCase().split(" ").filter(Boolean);
  const items = CATALOG.map(toItem)
    .filter((item): item is NicheItem => item !== null)
    .filter((item) => {
      const haystack = [item.id, item.t, item.s, ...item.tags]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 20);

  return { q: query, n: items.length, items };
}
