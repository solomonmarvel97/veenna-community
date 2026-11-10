# Veenna Community API

A tiny read-only service. It tells the Community app which speech models exist and which version is newest. It has no database, no accounts and no cookies, and no route accepts a request body, so dictation can never reach it.

| Route | Returns |
| --- | --- |
| `GET /v1/models.json` | Signed speech-model catalog |
| `GET /v1/latest.json` | Signed newest-version manifest |
| `GET /v1/health` | `204` |

Both files are `{ keyId, payload, signature }`; the signature is ed25519 over the payload with object keys sorted. The app ships the public keys and ignores a reply that does not verify.

```bash
bun scripts/gen-key.mjs dev      # signing key into .keys/ (never committed) + keys/dev.public.pem
bun scripts/build.mjs            # reads ../src/lib/voice/whisper-model-catalog.json and data/release.json
bun src/server.mjs               # PORT=8787 by default
bun test
```

The built `dist/v1/*.json` can also be hosted as plain static files. For a release, edit `data/release.json`, build with the production key (`--key /path/to/prod.private.pem --key-id prod`), and put the matching public key in `../electron/config/community.cjs`.
