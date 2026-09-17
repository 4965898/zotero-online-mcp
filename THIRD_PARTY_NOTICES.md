# Acknowledgments and licenses

This server is a new remote-only implementation built on the official MCP TypeScript SDK and Zotero Web API v3. It studies and adapts feature concepts from these MIT-licensed projects. Their desktop database code is not included. No upstream source files are shipped in this repository.

| Project | Reviewed commit | License / copyright |
| --- | --- | --- |
| [cookjohn/zotero-mcp](https://github.com/cookjohn/zotero-mcp) | `81d0777b49ded0959d197c7610d8b6e5f32c2485` | MIT; Copyright (c) 2024 the Zotero-MCP project contributors |
| [kaliaboi/mcp-zotero](https://github.com/kaliaboi/mcp-zotero) | `d219288bd60d75d56aa5a29627920e69eb1c8793` | MIT; Copyright (c) 2024 Abhishek Kalia |
| [54yyyu/zotero-mcp](https://github.com/54yyyu/zotero-mcp) | `8778e62e374516db003fa1c2977f416e3f7a30ce` | MIT; Copyright (c) 2025 Zotero MCP Contributors |

The feature comparison is in [docs/FEATURE_MATRIX.md](docs/FEATURE_MATRIX.md). Upstream license texts are retained in `licenses/` for attribution.

Runtime dependencies retain their own package licenses, distributed in `node_modules` by npm/Docker:

- `@modelcontextprotocol/sdk`: MIT
- `express`, `helmet`, `express-rate-limit`, `zod`: MIT
- `@citation-js/core`, `@citation-js/plugin-bibtex`, `@citation-js/plugin-ris`: MIT
- `pdfjs-dist`: Apache-2.0
- Transitive dependencies: see their distributed package LICENSE files and `package-lock.json`.

NoteGen compatibility was inspected at [codexu/note-gen](https://github.com/codexu/note-gen), commit `53711be6ca21b1533c236b19ae06bf598cff995b` (GPL-3.0). No NoteGen code is copied, linked, or bundled; our tests independently exercise the observed HTTP wire format.

Zotero and NoteGen are names of their respective projects. This is an independent integration, not an official Zotero or NoteGen product.
