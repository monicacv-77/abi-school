# Abi School

An interactive learning app for Abi: Investigations, Challenges, Simulations and her own Questions, each closed with a one-page Case Summary for her portfolio.

- How it works: [docs/ENGINE.md](docs/ENGINE.md)
- Cases: [`/cases`](cases) (JSON, one file per case)

## Setup

Environment variables (see `.env.example`):

| Name | What |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `APP_PASSCODE` | Passcode to open the app |
| `PARENT_PIN` | PIN for the parent dashboard |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when the Vercel Blob store is connected |

Local: `npm install`, add a `.env.local`, then `npm run dev`. Without a Blob token, data saves to `.data/`.

Offline engine check (no API key needed): `npx tsx scripts/engine-check.ts`.
