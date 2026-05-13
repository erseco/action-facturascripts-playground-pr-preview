# FacturaScripts Playground PR Preview Action

A GitHub Action that automatically posts or updates a sticky pull request comment containing a preview link to [FacturaScripts Playground](https://erseco.github.io/facturascripts-playground/) for any plugin, extension, or project ZIP.

## Usage

### Simple usage

```yaml
- name: Add FacturaScripts Playground preview
  uses: erseco/action-facturascripts-playground-pr-preview@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    zip-url: https://github.com/${{ github.repository }}/archive/refs/heads/${{ github.head_ref }}.zip
    title: My Plugin PR Preview
    description: Preview this PR in FacturaScripts Playground
```

### With extra plugins

```yaml
- name: Add FacturaScripts Playground preview
  uses: erseco/action-facturascripts-playground-pr-preview@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    zip-url: https://github.com/${{ github.repository }}/archive/refs/heads/${{ github.head_ref }}.zip
    extra-plugins: '["CommandPalette","https://facturascripts.com/plugins/mi-plugin-remoto"]'
    landing-page: /AdminPlugins
    debug-enabled: true
```

### With seed data

```yaml
- name: Add FacturaScripts Playground preview
  uses: erseco/action-facturascripts-playground-pr-preview@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    zip-url: https://github.com/${{ github.repository }}/archive/refs/heads/${{ github.head_ref }}.zip
    seed-json: >-
      {"customers":[{"codcliente":"CDEMO1","nombre":"Cliente Demo"}],
       "products":[{"referencia":"SKU-DEMO-001","descripcion":"Producto demo","precio":19.95}]}
```

### With advanced blueprint override

```yaml
- name: Add FacturaScripts Playground preview
  uses: erseco/action-facturascripts-playground-pr-preview@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    zip-url: https://github.com/${{ github.repository }}/archive/refs/heads/${{ github.head_ref }}.zip
    site-title: FacturaScripts Demo
    login-username: admin
    login-password: admin
    blueprint-json: >-
      {"debug":{"enabled":true},
       "siteOptions":{"timezone":"Europe/Madrid"},
       "plugins":["https://github.com/${{ github.repository }}/archive/refs/heads/${{ github.head_ref }}.zip","CommandPalette"]}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github-token` | ✅ | — | GitHub token with `pull-requests: write` permission |
| `zip-url` | ✅ | — | URL of the plugin/extension ZIP file to load in the playground |
| `mode` | ❌ | `comment` | How to publish the preview: `comment` (sticky PR comment) or `append-to-description` (managed block inside the PR body) |
| `title` | ❌ | `PR Preview` | Blueprint meta title |
| `description` | ❌ | `Preview this PR in FacturaScripts Playground` | Blueprint meta description |
| `author` | ❌ | `erseco` | Blueprint meta author |
| `playground-url` | ❌ | `https://erseco.github.io/facturascripts-playground/` | Base URL of the FacturaScripts Playground |
| `image-url` | ❌ | *(playground logo)* | URL of the image to display in the PR comment |
| `comment-marker` | ❌ | `facturascripts-playground-preview` | Hidden HTML marker used to identify and deduplicate the sticky PR comment, and as the base for the `:start`/`:end` markers in description mode |
| `extra-text` | ❌ | — | Optional text/HTML appended after the preview (useful for testing instructions) |
| `restore-button-if-removed` | ❌ | `true` | In `append-to-description` mode, restore the preview block if the PR author removed it |
| `pr-number` | ❌ | *(from event)* | Pull request number override. Required when triggered from a `workflow_run`; otherwise read from the `pull_request` event payload |
| `extra-plugins` | ❌ | — | JSON array of additional plugins appended after `zip-url` before the final override |
| `seed-json` | ❌ | — | JSON object with optional blueprint `seed` data |
| `landing-page` | ❌ | — | Blueprint `landingPage` value |
| `debug-enabled` | ❌ | — | Boolean-like value (`true`/`false`, `on`/`off`, `1`/`0`) for `debug.enabled` |
| `site-title` | ❌ | — | Blueprint `siteOptions.title` value |
| `site-locale` | ❌ | — | Blueprint `siteOptions.locale` value |
| `site-timezone` | ❌ | — | Blueprint `siteOptions.timezone` value |
| `login-username` | ❌ | — | Blueprint `login.username` value |
| `login-password` | ❌ | — | Blueprint `login.password` value |
| `blueprint-json` | ❌ | — | JSON object merged last into the generated blueprint, allowing advanced additions or overrides |

## Outputs

| Output | Description |
|---|---|
| `preview-url` | The full playground preview URL |
| `mode` | Effective publishing mode used (`comment` or `append-to-description`) |
| `comment-id` | ID of the managed preview comment in `comment` mode (empty otherwise) |
| `rendered-description` | Managed description block rendered in `append-to-description` mode (empty otherwise) |

## Required Workflow Permissions

The calling workflow must grant write access to pull requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Example Workflow

```yaml
name: PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened, edited]

permissions:
  contents: read
  pull-requests: write

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Add FacturaScripts Playground preview
        uses: erseco/action-facturascripts-playground-pr-preview@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          zip-url: https://github.com/${{ github.repository }}/archive/refs/heads/${{ github.head_ref }}.zip
          title: My Plugin PR Preview
          description: Preview this PR in FacturaScripts Playground
          extra-plugins: '["CommandPalette"]'
          site-locale: es_ES
          site-timezone: Europe/Madrid
```

## How It Works

1. **Blueprint generation** — The action builds a JSON blueprint from inputs:
   ```json
   {
     "meta": {
       "title": "My Plugin PR Preview",
       "author": "erseco",
       "description": "Preview this PR in FacturaScripts Playground"
     },
     "plugins": [
       "https://github.com/OWNER/REPO/archive/refs/heads/BRANCH.zip"
     ]
   }
   ```

   Optional inputs extend that blueprint only when they are provided. For example:

   ```json
   {
     "meta": {
       "title": "My Plugin PR Preview",
       "author": "erseco",
       "description": "Preview this PR in FacturaScripts Playground"
     },
     "plugins": [
       "https://github.com/OWNER/REPO/archive/refs/heads/BRANCH.zip",
       "CommandPalette"
     ],
     "landingPage": "/AdminPlugins",
     "debug": {
       "enabled": true
     },
     "siteOptions": {
       "title": "FacturaScripts Demo",
       "locale": "es_ES",
       "timezone": "Europe/Madrid"
     },
     "login": {
       "username": "admin",
       "password": "admin"
     },
     "seed": {
       "customers": [
         {
           "codcliente": "CDEMO1",
           "nombre": "Cliente Demo"
         }
       ]
     }
   }
   ```

   The action deduplicates `plugins` where possible, safely parses JSON inputs, and applies `blueprint-json` last as the final override layer.

2. **Base64url encoding** — The blueprint JSON is encoded as [base64url](https://datatracker.ietf.org/doc/html/rfc4648#section-5) (RFC 4648 §5), which replaces `+` with `-`, `/` with `_`, and strips trailing `=`.

3. **Preview URL** — The encoded blueprint is appended as the `blueprint-data` query parameter:
   ```
   https://erseco.github.io/facturascripts-playground/?blueprint-data=ENCODED_BLUEPRINT
   ```

4. **Sticky comment** — The action searches existing PR comments for a hidden HTML marker (`<!-- facturascripts-playground-preview -->`). If found, it updates that comment; otherwise it creates a new one. This prevents duplicate comments on repeated workflow runs (`synchronize`, `edited`, etc.).

## Development

### Prerequisites

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

This bundles `index.js` and its dependencies into `dist/index.cjs` using [esbuild](https://esbuild.github.io/).

> **Note:** Always commit the updated `dist/index.cjs` after making changes to `index.js`.

### Test

```bash
npm test
```
