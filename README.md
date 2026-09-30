# Email Parser Worker — Cloudflare Tunnel Health

A Cloudflare Worker that parses **Cloudflare Tunnel health change** notification emails using `postal-mime` and forwards tunnel details to Telegram and WhatsApp (via WAHA).

## Features
- Parses extracting:
  - **Title** (e.g. `Tunnel tunnel-name is now degraded`)
  - **Tunnel Name**
  - **Tunnel ID**
  - **New Status**
- Sends formatted notifications to Telegram.
- Forwards the same notification to a WhatsApp group via WAHA (optional, enable with `WA_ENABLED=true`).
- Supports handling forwarded emails (extracts original details).

```json
--- Extracted Data ---
{
  "title": "Tunnel tunnel-name is now degraded",
  "name": "tunnel-name",
  "id": "aBcD1234efgh567i890j1kl234567m80",
  "newStatus": "Degraded (status change)"
}
```

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Local Testing**:
    You can test with a local `.eml` file:
    ```bash
    npm run test:local -- /path/to/sample.eml
    ```

3.  **Typecheck**:
    ```bash
    npx tsc --noEmit
    ```

4.  **Configure secrets** (never commit these):
    ```bash
    wrangler secret put TELEGRAM_BOT_TOKEN
    wrangler secret put TELEGRAM_CHAT_ID
    # Optional WhatsApp forwarding via WAHA (requires WA_ENABLED=true in [vars]):
    wrangler secret put WA_API_URL
    wrangler secret put WA_API_KEY
    wrangler secret put WA_GROUP_ID
    # Optional, defaults to "default":
    wrangler secret put WA_SESSION
    ```

5.  **Deploy**:
    ```bash
    npm run deploy
    ```

## Local `.dev.vars` example

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=0123456789
# Optional WhatsApp forwarding via WAHA:
# WA_API_URL=https://waha.example.com
# WA_API_KEY=your-waha-api-key
# WA_GROUP_ID=120363421445353852@g.us
# WA_SESSION=default
```

Note: `WA_ENABLED` lives in `[vars]` in `wrangler.toml` (default `"false"`).
Set it to `"true"` to enable direct worker → WAHA forwarding (watch out for
duplicate notifications if `tele-wa-bridge` watches the same Telegram topic).
