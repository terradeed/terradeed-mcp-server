#!/usr/bin/env node
/**
 * TerraDeed MCP Server
 * x402-powered web scraping and structured extraction for AI agents
 * Protocol: x402 strict-v2 on Base mainnet (eip155:8453)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";

// ============================================================================
// Configuration
// ============================================================================

const PRIVATE_KEY = process.env.TERRADEED_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("ERROR: TERRADEED_PRIVATE_KEY environment variable required");
  process.exit(1);
}

const BASE_URL = "https://api.terradeed.co.uk";
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const CDP_FACILITATOR = "https://api.cdp.coinbase.com/platform/v2/x402";

// ============================================================================
// Viem client for on-chain reads
// ============================================================================

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

// ERC20 balanceOf ABI
const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// ============================================================================
// x402 Payment Flow — adapted from proven scrape.mjs (v2, EIP-3009)
// ============================================================================

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function chainIdFromNetwork(network) {
  if (network === "base") return 8453;
  if (network.startsWith("eip155:")) return parseInt(network.split(":")[1], 10);
  throw new Error(`Unsupported network: ${network}`);
}

async function requestOnce(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, headers: res.headers, json, text };
}

async function x402PayAndFetch(endpoint, body, method = "POST") {
  const { privateKeyToAccount } = await import("viem/accounts");
  const account = privateKeyToAccount(
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`
  );

  const requestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  };

  // Step 1: Initial request — expect 402
  const first = await requestOnce(`${BASE_URL}${endpoint}`, requestInit);
  if (first.status !== 402) {
    throw new Error(`Expected 402, got ${first.status}: ${first.text.slice(0, 200)}`);
  }

  // Step 2: Parse PaymentRequired from body or header
  let paymentRequired = first.json || {};
  if (!paymentRequired?.accepts?.length) {
    const hdr = first.headers.get("payment-required") || first.headers.get("PAYMENT-REQUIRED");
    if (!hdr) {
      throw new Error("402 missing accepts[] and no payment-required header");
    }
    Object.assign(paymentRequired, JSON.parse(Buffer.from(hdr, "base64").toString("utf-8")));
  }
  if (!paymentRequired?.accepts?.length) {
    throw new Error("402 response missing accepts[] after header decode");
  }

  // Step 3: Pick first accepted requirement (server preference)
  const req = paymentRequired.accepts[0];
  const chainId = chainIdFromNetwork(req.network);

  // Step 4: Build EIP-3009 TransferWithAuthorization
  const validAfter = 0n;
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + (req.maxTimeoutSeconds || 600)
  );
  const nonce = randomNonce();

  const authorization = {
    from: account.address,
    to: req.payTo,
    value: BigInt(req.amount ?? req.maxAmountRequired ?? "10000"),
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await account.signTypedData({
    domain: {
      name: req.extra?.name ?? "USD Coin",
      version: req.extra?.version ?? "2",
      chainId,
      verifyingContract: req.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  // Step 5: Build v2 PaymentPayload
  const paymentPayload = {
    x402Version: 2,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce: authorization.nonce,
      },
    },
    accepted: req,
  };

  if (paymentRequired.resource) {
    paymentPayload.resource = paymentRequired.resource;
  }
  if (paymentRequired.extensions) {
    paymentPayload.extensions = paymentRequired.extensions;
  }

  // Step 6: Retry with PAYMENT-SIGNATURE header
  const paid = await requestOnce(`${BASE_URL}${endpoint}`, {
    ...requestInit,
    headers: {
      ...requestInit.headers,
      "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(paymentPayload)).toString("base64"),
    },
  });

  if (!paid.status.toString().startsWith("2")) {
    throw new Error(`Final request failed (${paid.status}): ${paid.text.slice(0, 500)}`);
  }

  // Extract settlement info from response header
  const settleHeader = paid.headers.get("PAYMENT-RESPONSE") || paid.headers.get("payment-response");
  let txHash = "unknown";
  if (settleHeader) {
    try {
      const settle = JSON.parse(Buffer.from(settleHeader, "base64").toString("utf-8"));
      txHash = settle.transaction || settle.txHash || "unknown";
    } catch { /* ignore parse errors */ }
  }

  // Truncate to 60k chars to protect agent context
  const truncated = paid.text.length > 60000
    ? paid.text.slice(0, 60000) + "\n\n[TRUNCATED — 60k char limit reached]"
    : paid.text;

  return {
    content: truncated,
    cost: formatUnits(BigInt(req.amount ?? req.maxAmountRequired ?? "10000"), 6),
    currency: "USDC",
    txHash,
    endpoint: `${BASE_URL}${endpoint}`,
  };
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "terradeed-mcp",
    version: "0.1.0",
  },
  { capabilities: { tools: {} } }
);

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "terradeed_scrape_url",
        description:
          "Scrape any public URL and return clean, LLM-ready markdown. " +
          "Cost: $0.01 USDC per call. Supports JavaScript-rendered pages.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape",
            },
            render_js: {
              type: "boolean",
              description: "Render JavaScript before scraping (slower, more complete)",
              default: false,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "terradeed_extract_structured",
        description:
          "Extract structured JSON data from any URL using a provided schema. " +
          "Cost: $0.05 USDC per call. The schema defines exactly what fields to extract.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to extract data from",
            },
            schema: {
              type: "object",
              description: "JSONSchema object defining the output shape",
            },
            instructions: {
              type: "string",
              description: "Optional plain-language instructions for the extraction",
            },
          },
          required: ["url", "schema"],
        },
      },
      {
        name: "terradeed_check_wallet",
        description:
          "Check the USDC balance of a wallet on Base mainnet. Free — no x402 payment required.",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Ethereum address to check (defaults to the payment wallet)",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "terradeed_scrape_url") {
      const { url, render_js = false } = args;
      const result = await x402PayAndFetch("/scrape", { url, render_js });

      return {
        content: [
          {
            type: "text",
            text: result.content,
          },
          {
            type: "text",
            text: `\n---\n💰 Cost: $${result.cost} ${result.currency}\n🔗 Tx: ${result.txHash}\n📁 Endpoint: ${result.endpoint}`,
          },
        ],
      };
    }

    if (name === "terradeed_extract_structured") {
      const { url, schema, instructions = "" } = args;
      const result = await x402PayAndFetch("/extract", { url, schema, instructions });

      return {
        content: [
          {
            type: "text",
            text: result.content,
          },
          {
            type: "text",
            text: `\n---\n💰 Cost: $${result.cost} ${result.currency}\n🔗 Tx: ${result.txHash}\n📁 Endpoint: ${result.endpoint}`,
          },
        ],
      };
    }

    if (name === "terradeed_check_wallet") {
      const address = args.address || "0x4E024e356bd01853654b7B5196F2B85F67Cc39EC";

      const balance = await publicClient.readContract({
        address: USDC_CONTRACT,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });

      const formatted = formatUnits(balance, 6);

      return {
        content: [
          {
            type: "text",
            text: `USDC Balance for ${address}\nNetwork: Base mainnet\nBalance: ${formatted} USDC`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Error: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Boot
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TerraDeed MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
