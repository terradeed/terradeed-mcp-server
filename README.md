# Terradeed MCP Server

x402-powered web scraping and structured data extraction for AI agents.

## Overview

This MCP server connects your AI agent to the [Terradeed Scrape API](https://api.terradeed.co.uk), enabling:

- **Web scraping** — Clean, LLM-ready markdown from any URL ($0.01 USDC)
- **Structured extraction** — Named fields back as JSON from any page ($0.05 USDC)
- **Property extraction** — UK commercial property and land intelligence from a listing URL ($0.10 USDC)
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

Clean, LLM-ready markdown from any URL. JavaScript rendering included. Feed web content directly into agent context without parsing HTML.

**Cost:** $0.01 USDC per call

```json
{
  "url": "https://example.com",
  "render_js": false
}
```

### `terradeed_extract_structured`

Structured JSON from any webpage. Name the fields you want and get them back with confidence scores. The schema defines exactly what fields to extract.

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

### `terradeed_extract_property`

UK commercial property and land intelligence from any listing URL. Returns structured data (address, price, site area, use class, tenure, frontage, coordinates), auto-enriched with flood risk, listed buildings, and EPC data. No field configuration needed.

**Cost:** $0.10 USDC per call

```json
{
  "url": "https://example.com/listing",
  "render_js": true
}
```

Calls `POST /extract/property` with `{ url, js_render }`. `render_js` defaults to `true`.

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

- [Terradeed](https://terradeed.co.uk)
- [API Docs](https://api.terradeed.co.uk)
- [x402 Protocol](https://x402.org)

## License

MIT
