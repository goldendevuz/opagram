<div align="center">
  <img src="./src-tauri/icons/128x128.png" width="100" alt="OpaGram" />
  <h1>OpaGram</h1>
  <p>A simple, distraction-free Telegram client for reading and writing messages.</p>

  <h4>
    <a href="#keys">Keys</a> | <a href="#run">Run</a> | <a href="#deploy">Deploy</a>
  </h4>

  [![Stars](https://img.shields.io/github/stars/goldendevuz/opagram?logo=github&style=plastic&labelColor=18181b&color=ff7a3d&logoColor=ff7a3d&cacheSeconds=10000)](https://github.com/goldendevuz/opagram/stargazers)
  &nbsp;[![Downloads](https://img.shields.io/github/downloads/goldendevuz/opagram/total?logo=hack-the-box&label=downloads&style=plastic&labelColor=18181b&color=ff7a3d&logoColor=ff7a3d&cacheSeconds=10000)](https://github.com/goldendevuz/opagram/releases)
  &nbsp;[![Web](https://img.shields.io/badge/web-opagram.univel.uz-ff7a3d?logo=googlechrome&style=plastic&labelColor=18181b&color=ff7a3d&logoColor=ff7a3d&cacheSeconds=10000)](https://opagram.univel.uz)
  &nbsp;[![Platforms](https://img.shields.io/badge/platforms-web%20%7C%20android%20%7C%20windows-ff7a3d?style=plastic&labelColor=18181b&color=ff7a3d&logoColor=ff7a3d&cacheSeconds=10000)](#run)
  &nbsp;[![Languages](https://img.shields.io/badge/lang-uz%20%7C%20ru%20%7C%20en-ff7a3d?style=plastic&labelColor=18181b&color=ff7a3d&logoColor=ff7a3d&cacheSeconds=10000)](#run)
</div>

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
