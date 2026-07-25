# TerraDeed MCP Server

x402-powered web scraping and structured data extraction for AI agents.

## Overview

This MCP server connects your AI agent to the [TerraDeed Scrape API](https://api.terradeed.co.uk), enabling:

- **Web scraping** — Clean, LLM-ready markdown from any URL ($0.01 USDC)
- **Structured extraction** — Schema-driven JSON data from any page ($0.05 USDC)
- **Wallet balance checks** — Free USDC balance lookups on Base mainnet

Payments are handled transparently via the [x402 protocol](https://x402.org) on Base mainnet using USDC.

## Installation

### Via npx (recommended)

```bash
TERRADEED_PRIVATE_KEY=0x... npx terradeed-mcp-server
```

### Global install

```bash
npm install -g terradeed-mcp-server
TERRADEED_PRIVATE_KEY=0x... terradeed-mcp-server
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TERRADEED_PRIVATE_KEY` | Yes | Ethereum private key for signing x402 payments. Must hold USDC on Base mainnet. |

## Tools

### `terradeed_scrape_url`

Scrape any public URL and return clean markdown.

**Cost:** $0.01 USDC per call

```json
{
  "url": "https://example.com",
  "render_js": false
}
```

### `terradeed_extract_structured`

Extract structured JSON data using a schema.

**Cost:** $0.05 USDC per call

```json
{
  "url": "https://example.com",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "price": { "type": "number" }
    }
  },
  "instructions": "Extract the product title and price"
}
```

### `terradeed_check_wallet`

Check USDC balance on Base mainnet. Free.

```json
{
  "address": "0x..."
}
```

## Configuration

Add to your MCP client config (e.g., Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "terradeed": {
      "command": "npx",
      "args": ["terradeed-mcp-server"],
      "env": {
        "TERRADEED_PRIVATE_KEY": "your-private-key"
      }
    }
  }
}
```

## Links

- [TerraDeed](https://terradeed.co.uk)
- [API Docs](https://api.terradeed.co.uk)
- [x402 Protocol](https://x402.org)

## License

MIT
