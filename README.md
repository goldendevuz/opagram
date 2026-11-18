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
