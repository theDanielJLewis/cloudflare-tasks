1. Install dependencies with your favorite package manager (e.g. `npm install`, `yarn install`, `pnpm install`, etc.).
2. [Create a Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with Zone.Dmarc Management and Zone.DNS edit permissions for all zones (the DMARC management API is not required and not actually used, yet, because Cloudflare doesn't support activating DMARC management via API, yet).
3. Copy `.env-sample` to `.env` and fill in the values.
4. Run `node activateDmarc.js` to automatically create the SPF and DMARC records for all domains in your account (except those in `SKIP_DOMAINS`).

There's also `deleteDmarc.js` which will delete DMARC and SPF records for all domains in your account (except those in `SKIP_DOMAINS`) in case you messed up and want to start over or accidentally made duplicate records.
