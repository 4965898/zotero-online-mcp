# Zotero MCP

An MCP server that gives an AI assistant full access to your **online** Zotero library — with **82 tools**.

One environment variable, no local Zotero desktop app, no service to deploy, no tokens to manage.

> Independent open-source project. Not affiliated with or endorsed by Zotero.

**Languages:** English · [简体中文](README.zh-CN.md)

## Why this one

The existing Zotero MCP servers are either light on tools or awkward to run. This one is both the
most complete and the simplest to start:

| | Tools | Setup | Writes |
|---|---|---|---|
| **zotero-mcp** (this project) | **82** | one env var | preview + confirm |
| cookjohn (Zotero plugin) | ~20 | install a Zotero plugin | needs Zotero running |
| kaliaboi | 5 | two env vars | none |
| 54yyyu | ~52 | Python + config file | direct |

It works with **online libraries only** — the same data Zotero syncs to zotero.org. Local files,
desktop selections and unsynced items are out of reach by design, which is what lets it run anywhere
without touching your computer's Zotero install.

## Quick start

**1. Create a Zotero API key** at <https://www.zotero.org/settings/keys/new>.
Tick the permissions you want (reading is enough to start).

**2. Install and build:**

```bash
git clone https://github.com/4965898/zotero-online-mcp.git && cd zotero-online-mcp
npm ci
npm run build
```

**3. Put your key in a file.** Run `setup-local.cmd` (Windows) — it copies `.env.local.example`
to `.env` — then paste your key into `.env`:

```
ZOTERO_API_KEY=your-key-here
```

Keeping the key in `.env` rather than in the client config means one file to edit and no secret
duplicated across every client you own.

**4. Point your MCP client at it.**

### Cherry Studio

Settings → MCP Servers → Add → type `stdio`, then:

```json
{
  "command": "D:/path/to/zotero-online-mcp/start-stdio.cmd",
  "args": []
}
```

`start-stdio.cmd` reads `.env` for you, so no key appears here at all.

### Claude Desktop / Cursor

Add to `claude_desktop_config.json` (or `mcp.json` for Cursor):

```json
{
  "mcpServers": {
    "zotero": {
      "command": "D:/path/to/zotero-online-mcp/start-stdio.cmd",
      "args": []
    }
  }
}
```

Restart the client. You should see 82 tools, 51 of them read-only.

<details>
<summary>macOS / Linux, or if you prefer no launcher script</summary>

Point the client straight at the built entry point and pass the key as an env var:

```json
{
  "command": "node",
  "args": ["/path/to/zotero-online-mcp/dist/stdio.js"],
  "env": { "ZOTERO_API_KEY": "your-key-here" }
}
```

On Windows this works too — use forward slashes in the path, or double backslashes.

</details>

### NoteGen

NoteGen speaks standard MCP over HTTP, so start the server in HTTP mode first:

```bash
npm run setup   # creates .env with a fresh encryption key
npm start       # listens on http://localhost:3000
```

Then add the server in NoteGen:

```json
{
  "mcpServers": {
    "zotero-online": {
      "url": "http://YOUR-HOST:3000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ZOTERO_API_KEY"
      }
    }
  }
}
```

> NoteGen infers the transport from the fields: `command` means stdio, `url` means http, so the JSON
> needs no `type`.
>
> **If the import appears to do nothing**, NoteGen skips servers whose name already exists — it never
> overwrites. Delete the old entry in the MCP server list and import again.
>
> If your NoteGen build can launch local processes, use the **stdio** config above instead and
> skip the server entirely.
>
> A regression test in this repo pins NoteGen's actual wire behaviour (protocol version
> negotiation, session headers, notification and SSE response framing), so the transport layer is
> aligned with what the app sends.

### RikkaHub (Android)

RikkaHub supports SSE and Streamable HTTP but **cannot** launch a local process, so a phone must
use HTTP mode — and the phone has to be able to reach the machine running the server.

**On the PC (Windows):**

1. Run `setup-local.cmd` and paste your Zotero key into the generated `.env`.
2. `npm ci && npm run build`.
3. Run `allow-firewall.cmd` **as Administrator** to add the inbound rule for TCP 3000. It applies
   to Private/Domain networks only, so nothing is opened on café or airport Wi-Fi.
4. Run `start-http.cmd` to start the server.
5. `npm run address` prints every reachable address plus ready-to-paste configs.

**In RikkaHub on the phone:**

| Field | Value |
|---|---|
| Name | `zotero` |
| Transport type | `Streamable HTTP` |
| Server URL | `http://192.168.x.x:3000/mcp` (your PC's LAN IP) |
| Header | name `Authorization`, value `Bearer YOUR_ZOTERO_API_KEY` |

`Bearer` and the credential are separated by exactly one space.

If it will not connect, switch the transport type to `SSE` and use `/sse` instead.

> The server accepts every local interface address as a valid `Host`, which is what lets a phone
> reach `http://192.168.x.x:3000` directly. Requests carrying an unknown `Host` are still refused
> with 403.
>
> **Off that network the phone cannot connect** — the physical limit of having no public entry
> point. For access from anywhere, put the server behind a reachable domain with TLS (see
> `compose.production.yml`).

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `ZOTERO_API_KEY` | **yes** | Your Zotero API key |
| `ZOTERO_USER_ID` | no | Your numeric Zotero user ID. **Omit it and the server looks it up for you** |
| `ZOTERO_WRITE` | no | Set `true` to enable the 31 write tools. Default is read-only |
| `EMBEDDING_URL` | no | HTTPS embedding endpoint for semantic search |
| `EMBEDDING_MODEL` | no | Embedding model name |
| `EMBEDDING_API_KEY` | no | Key for the embedding endpoint |
| `MAX_FILE_MB` | no | Attachment size limit, default `20` |
| `PASSTHROUGH_KEYS` | no | HTTP mode only. `true` lets clients send their Zotero key as the bearer credential instead of a service token. Default `false` |
| `ALLOWED_ORIGINS` | no | Extra web origins to admit (comma separated). Desktop client origins and this machine's own http origins are already allowed by default |

### Writes are opt-in and always previewed

Read-only until you set `ZOTERO_WRITE=true`. When enabled, every change still returns an exact
preview and a confirmation token first — the AI shows you what it intends to change, and nothing
reaches Zotero until you approve it. Deletions are recoverable through Zotero's trash.

## What you get

82 tools across the full research flow. Highlights:

- **Find** — search a library or every group library, advanced field filters, recent additions, tags,
  saved searches, DOI and ISBN lookup, BibTeX/RIS/CSL import
- **Read** — item details and batches, children, abstracts, notes, annotations, synced full text,
  real PDF page extraction, outlines, attachment download
- **Cite** — bibliography and citation generation from your own items
- **Organize** — collections, tags, relations, item-to-collection membership (all previewed)
- **Analyse** — library statistics, duplicate detection, duplicate merge
- **Optionally** — semantic search and "find similar" over your library, with an embedding provider

Full catalog with schemas: [`docs/TOOLS.md`](docs/TOOLS.md).

## Using it on several machines, or from a phone

In stdio mode the server is a process your client starts, so it runs wherever that client runs.
There is nothing to reach over a network and no address to configure. The practical consequence:

| Client | Works? | How |
|---|---|---|
| Desktop app on the same PC (Cherry Studio, Claude Desktop, Cursor) | yes | [steps above](#quick-start); nothing else needed |
| Desktop app on a second PC | yes | same steps on that PC — clone, build, `.env` |
| NoteGen | yes | [stdio config](#notegen), or the HTTP URL if your build cannot launch processes |
| A phone or tablet app that can run local processes (e.g. Termux) | yes | same steps on the device |
| RikkaHub and other URL-only mobile apps | needs the HTTP mode below | [RikkaHub setup](#rikkahub-android); the device must be able to reach the host |
| Any client on a different network | needs the HTTP mode below | requires a host those devices can reach |

**Installing it on each machine is the recommended path**, and it is what makes the setup immune to
port forwarding, tunnels, TLS and uptime. Your API key gets copied to each device, which is the one
cost — Zotero keys are revocable per-key, so you can issue one key per device and revoke any of them
independently at <https://www.zotero.org/settings/keys>.

## Optional: run it as a service

Some clients — most mobile AI apps, for instance — can only connect to a URL and cannot launch a
local process. Those need the HTTP mode: the same 82 tools run as a server, and clients reach it over
the network. This requires a host the devices can reach, so it is only worth it if you have one.

```bash
npm run setup   # creates .env with a fresh encryption key
npm start
```

Then open <http://localhost:3000>, paste your key once, and copy the generated client config.
See [`.env.example`](.env.example) for all settings and [`SECURITY.md`](SECURITY.md) for the
security model. Both transports are supported: Streamable HTTP at `/mcp` and legacy SSE at `/sse`.

### Serving a phone on your own network

Windows helpers for the common single-user case:

1. `setup-local.cmd` — creates `.env` from the template. Paste your key into it.
2. `npm ci && npm run build` — install and compile.
3. `allow-firewall.cmd` — adds an inbound rule for TCP 3000. **Run as Administrator**, once.
   It applies to Private/Domain networks only, so nothing is opened on café or airport Wi-Fi.
4. `start-http.cmd` — starts the server and prints the exact config to paste into each client.

`npm run address` prints the same information on its own, listing every local address this machine
can be reached at plus ready-to-paste configs for Cherry Studio, RikkaHub and stdio clients.

> The server accepts every local interface address as a valid `Host`, which is what lets a phone
> reach `http://192.168.x.x:3000` directly. Requests carrying an unknown `Host` are still refused
> with 403.

### Sending the Zotero key directly

By default a client sends a **service token** issued by this server. If you would rather skip that
step, set `PASSTHROUGH_KEYS=true` and clients send their **Zotero API key** as the bearer credential
instead — nothing else to generate, nothing to copy out of the landing page:

```json
{
  "mcpServers": {
    "zotero": {
      "type": "streamable-http",
      "url": "http://YOUR-HOST:3000/mcp",
      "headers": { "Authorization": "Bearer YOUR_ZOTERO_API_KEY" }
    }
  }
}
```

For SSE clients, point `url` at `/sse` instead.

The key is verified against Zotero once and cached briefly, so repeat requests cost nothing extra.
Both credential kinds keep working while this is on, so existing service tokens are not invalidated.

**The trade-off is real:** the Zotero key gets copied into every client config, and you lose
per-client revocation — revoking one device means revoking the Zotero key itself. Leave
`PASSTHROUGH_KEYS=false` (the default) when more than one person uses the instance.

### Tokens never expire

Tokens issued by this mode **never expire** unless you set `TOKEN_TTL_DAYS` to a positive number;
they stay valid until you revoke them on the landing page or delete the connection.

For a public deployment behind a domain and TLS, use `compose.production.yml` with
`deploy/nginx.conf.example`.

## Development

```bash
npm run check        # typecheck + tests + build
npm run stdio        # build and run the stdio server directly
npm run docs:tools   # regenerate docs/TOOLS.md from the registered schemas
```

Tests use in-memory SQLite and synthetic upstream responses; no Zotero account is required. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## Limits

- Online, synced content only.
- Large libraries cannot be enumerated in one call; scans report their coverage and flag truncation.
- Extracted PDF text is reliable for prose, unreliable for maths and tables.

## License

MIT. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
