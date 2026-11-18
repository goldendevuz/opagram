# OpaGram

A simple, distraction-free Telegram client for reading and writing messages.
Web first (also packaged as an Android app), desktop later.

Languages: Uzbek (default), Russian, English.

## Keys

The project ships with no Telegram keys. Each user enters their own `api_id`
and `api_hash` (from my.telegram.org) on first launch, then logs in with their
own account. The keys and the session are stored only on that user's device
and are never sent to any server.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (installable as a PWA)
```

Open `/?demo` to try the interface with sample chats and no Telegram account.

## Stack

Vite, React, TypeScript, GramJS (Telegram MTProto in the browser), Motion.

## Deploy

The server polls GitHub once a minute (`deploy/auto-deploy.sh`, started from cron) and runs
`deploy/deploy.sh` when `main` has a new commit: pull, build in a Node container, serve with nginx.
A Cloudflare tunnel publishes it at https://opagram.univel.uz. Nothing connects into the server from outside.

```cron
* * * * * flock -n /tmp/opagram-deploy.lock ~/projects/opagram/deploy/auto-deploy.sh >> ~/opagram-deploy.log 2>&1
```
