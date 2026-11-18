# Agent Drop Board

Free collectible badges for Agent ID holders. One badge per drop, gas only,
verified on-chain. Built for the Binance Agentic Wallet Hackathon.

## How it works

1. Connect a wallet that holds an Agent ID (Binance Agentic Wallet).
2. The board reads live drops from the `AgentDropBoard` contract on BNB Smart Chain.
3. Claim a badge. The contract checks Agent ID ownership on-chain for every
   claim, enforces one badge per wallet per drop, and rejects any payment:
   claims are free apart from gas.

## Contract

- Network: BNB Smart Chain mainnet (chain ID 56)
- Contract: `0x027654e0DD61CcDFb7c4cb53Cd7E5cf9d310196c`
- Agent ID registry: `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
- Drop 1: "Genesis Agent", 500 supply
- Contract source verified on Sourcify (exact match).

## This repository

This repo serves the board as a static site. `index.html`, `styles.css`, and
the prebuilt `app.js` bundle at the root are what visitors load. The
unbundled source lives in `src/` (`app.js` + `config.js`); all
environment-specific settings are in `src/config.js`.

## Rebuild from source

```sh
npm install
npm run build   # esbuild bundles src/app.js (+ ethers) into dist/app.js
```

Serve `dist/` (or copy `dist/app.js` next to `index.html` and `styles.css`).

## Safety notes

- The site never asks for a seed phrase, private key, or pairing code.
- Claims are plain wallet transactions the user reviews and confirms.
- No backend, no tracking, no API keys. Drop data is read from a public
  BSC RPC endpoint or the visitor's own wallet provider.

## License

MIT.
