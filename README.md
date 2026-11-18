# OpaGram

A simple, distraction-free Telegram client for reading and writing messages.
Web first (also packaged as an Android app), desktop later.

Languages: Uzbek (default), Russian, English.

## Secrets

Telegram `api_id` and `api_hash` are never committed. Provide them through
environment variables locally and GitHub Secrets in CI:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`

User sessions stay on the user's own device and are never sent to a server.
