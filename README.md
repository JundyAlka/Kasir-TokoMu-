# TokoMu

TokoMu is a tablet-first retail operating system for PCM Muhammadiyah Grabag. The application brings together cashier workflows, inventory control, customer receivables, investor records, profit sharing, and monthly PCM reporting in one workspace.

## Product Scope

- Visual point-of-sale interface with cart management and checkout recording.
- Inventory management for daily goods, stock thresholds, and restock activity.
- Customer receivables tracking for active kasbon and follow-up context.
- Investor and investment management for cash capital and consignment goods.
- Profit-sharing calculation for investor payouts, PCM allocation, reserve funds, and store operations.
- Monthly PCM report generation with frozen data snapshots and downloadable PDF output.
- Role-based access control for pimpinan, pengelola keuangan, and kasir.

## Key Modules

| Module | Capability |
| --- | --- |
| Kasir | Transaction capture, payment method selection, and stock deduction. |
| Inventaris | Product catalog, pricing, stock levels, and restock monitoring. |
| Buku Hutang | Customer debt records and repayment status. |
| Investor | Investor profiles and hybrid investment records. |
| Bagi Hasil | Periodic payout preview, draft persistence, approval, and paid status. |
| Laporan | Profit-loss reporting sourced from transaction, item, and expense data. |
| Laporan PCM | Official monthly reporting for PCM review with PDF export. |
| Pengaturan | Store profile, PCM identity, payment methods, and staff access. |

## Technology

- Next.js App Router
- React and Tailwind CSS
- shadcn/ui and Base UI primitives
- Drizzle ORM with PostgreSQL
- Better Auth
- React PDF renderer

## Gemini AI Setup

TokoMu AI uses the Gemini API through Google's OpenAI-compatible endpoint:
`https://generativelanguage.googleapis.com/v1beta/openai/`.

To configure it locally:

1. Open [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create or copy an API key.
3. Add these values to `.env.local`:

```env
GEMINI_API_KEY=replace-with-google-ai-studio-key
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_VISION_MODEL=gemini-2.0-flash
```

The chat assistant and receipt OCR both use Gemini. Receipt OCR sends base64 `image_url` content to `GEMINI_VISION_MODEL`.

## Data And Access Model

TokoMu uses a workspace ownership model. The first registered user becomes `pimpinan` for their workspace. Additional users can be invited as `pengelola_keuangan` or `kasir`, with server-side RBAC applied to pages and API routes.

Operational data is scoped by `workspaceOwnerId` so multiple users in the same workspace work against the same store, investor, payout, and report records.

## Security Notes

Runtime credentials are expected to be supplied through environment variables and are not committed to the repository. Local database files, generated logs, build output, and temporary test artifacts are ignored.

## Status

This codebase is prepared as a TokoMu PCM Muhammadiyah Grabag demo and SUS testing build, with seeded retail, investor, and reporting data for evaluation.
