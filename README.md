# Terradeed MCP Server

x402-powered web scraping and structured data extraction for AI agents.

## Overview

This MCP server connects your AI agent to the [Terradeed Scrape API](https://api.terradeed.co.uk), enabling:

- **Web scraping:** Clean, LLM-ready markdown from any URL ($0.01 USDC)
- **Structured extraction:** Named fields back as JSON from any page ($0.05 USDC)
- **Property extraction:** UK commercial property and land intelligence from a listing URL ($0.10 USDC)
- **UK company checks:** Companies House profile, status, overdue flags, SIC codes and recent filings, no Companies House key needed ($0.01 USDC)
- **UK company search:** find companies by name on the Companies House register ($0.01 USDC)
- **UK tenders:** public tender notices from Find a Tender and Contracts Finder ($0.02 USDC)
- **Wallet balance checks:** Free USDC balance lookups on Base mainnet

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

### `terradeed_uk_company`

UK company check from the Companies House public register: status, type, incorporation date, registered office, SIC codes, previous names, accounts and confirmation statement due dates with overdue flags, and recent filings. Officer and PSC names are omitted. Unknown numbers return 404 and are not charged.

**Cost:** $0.01 USDC per lookup

```json
{ "number": "00445790", "filings": 10 }
```

### `terradeed_uk_company_search`

Find UK companies by name. Up to 20 matches with company number, dates and registered office.

**Cost:** $0.01 USDC per search

```json
{ "q": "tesco", "limit": 10 }
```

### `terradeed_uk_tenders`

UK public tender notices from Find a Tender and Contracts Finder, Open Government Licence v3.0. Contact details are omitted.

**Cost:** $0.02 USDC per search

```json
{ "q": "AI training", "region": "north-west", "stage": "tender", "limit": 25 }
```

### `terradeed_extract_property`

UK commercial property and land intelligence from any listing URL. Returns structured data (address, price, site area, use class, tenure, frontage, coordinates), with attempted enrichment from flood risk, listed buildings and EPC data where available. No field configuration needed.

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
