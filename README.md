# VitePaper — Outline Wiki × VitePress Blog

**VitePaper** is a minimalist, self-hosted technical blogging framework that syncs and publishes Markdown articles directly from an [Outline](https://www.getoutline.com/) wiki instance.

## Attribution & Credits

The visual design, color palettes (Warm Parchment Light & Slate/Orange Dark), typography (`IBM Plex Mono`), and layout structure of **VitePaper** are a port and adaptation of **[AstroPaper](https://github.com/satnaing/astro-paper)** created by **[Sat Naing](https://github.com/satnaing)** (MIT License), built on top of [VitePress](https://vitepress.dev/) and [Tailwind CSS v4](https://tailwindcss.com/).

---

## Features

* **Outline Wiki Publishing Pipeline (`scripts/sync.ts`)**:
  * Syncs articles placed inside your configured **Published** parent document (or **Drafts** parent document when running `pnpm sync:drafts`).
  * Automatically downloads private `/api/attachments.redirect?id=...` images and file attachments using your `OUTLINE_API_KEY` and caches them locally in `content/public/attachments/`.
  * Recursively syncs nested subfolders and applies subfolder titles as automatic `#tags`.
  * Normalizes Outline ProseMirror Markdown quirks (bold inline code, named Outline icons, `:::warning` / `:::tip` / `:::info` / `:::danger` callouts, and `mermaid` diagrams).
* **Custom Frontmatter & Navbar Pinning in Outline**:
  * Add an optional ```` ```yaml ```` code block at the very top of any Outline document to configure metadata or pin pages to the top navigation bar (automatically stripped from the rendered article body):
    ````markdown
    ```yaml
    tags: [reverse-engineering, hardware, linux]
    featured: true
    updated: 2026-10-01
    slug: custom-url-slug
    description: Custom SEO summary and post card excerpt.
    nav: About Me
    navOrder: 30
    excludeFromPosts: true
    ```
    ````
* **Cross-Document Links, `@` Mentions & Backlinks**:
  * Links between published Outline documents (`/doc/...`, full Outline URLs, or `@` document mentions) are automatically rewritten to `/posts/<slug>` links.
  * Links pointing to *private/unpublished* Outline notes are gracefully unwrapped to plain text so public readers never hit a broken link or login wall.
  * Automatically computes bidirectional **Referenced In** backlinks displayed at the bottom of referenced articles.
* **Live Unlisted Draft Previews (`/drafts`)**:
  * Articles placed inside your Outline **Drafts** folder (or marked with `draft: true` in YAML) are synced as unlisted pages (`noindex, nofollow`), excluded from all public feeds, tags, RSS, sitemap, and `Ctrl+K` search.
  * Preview drafts live at `/drafts` with a **Draft Preview** banner before moving them into **Published**.
* **Tabbed Code Blocks (`[tab: ...]` & `[tab-group: ...]`)**:
  * Add `[tab: <Tab Title>]` on the first line of consecutive code blocks in Outline to automatically combine them into a VitePress tabbed code group (`::: code-group`).
  * Optionally add `[tab-group: <group-name>]` when placing multiple distinct tab groups back-to-back (e.g. a `request` tab group immediately followed by a `response` tab group).
* **Brand Logos, Iconify Icons & Social Links in Prose**:
  * Render your configured social links bar anywhere in an Outline document using inline code `` `integration: socials` ``.
  * Embed any [Simple Icons](https://simpleicons.org/) brand logo or [Iconify / Icônes](https://icones.js.org/) icon inline in prose using `` `icon:<brand>` `` (e.g. `` `icon:github` ``, `` `icon:docker` ``, `` `icon:linux` ``, `` `icon:unraid` ``, `` `icon:vue` ``) or `` `icon:<collection>:<name>` `` (e.g. `` `icon:lucide:cpu` ``, `` `icon:majesticons:door-exit` ``).
* **Zero-Downtime Webhook Rebuilds (`scripts/server.ts`)**:
  * Serves the static site via [`sirv`](https://github.com/lukeed/sirv) with `ETag` and immutable asset caching, alongside a `POST /api/webhook/outline` listener.
  * Verifies Outline's `Outline-Signature` (`HMAC-SHA256`), debounces rapid webhook bursts (3s), builds into a staging directory (`.vitepress/dist-next`), and atomically swaps `.vitepress/dist` with zero downtime.

---

## Outline Folder Structure

In your Outline workspace, create a Collection (e.g. `Blog` or `VitePaper`) with two top-level parent documents:

```text
📁 Blog (Outline Collection)
 ├── 📄 Published          <-- Any child document placed inside here is published live
 │    ├── 📄 About Me      <-- (with `nav: About Me` & `excludeFromPosts: true` in YAML block)
 │    ├── 📁 Homelab       <-- Subfolder name automatically becomes the `#homelab` tag
 │    │    └── 📄 My Post
 │    └── 📄 Another Post
 └── 📄 Drafts             <-- Synced locally when running `pnpm sync:drafts`
```

---

## Quick Start (Local Development)

### 1. Create Your Local Config (`vitepaper.local.ts` & `.env`)
Personal branding and Outline credentials live in gitignored files (`vitepaper.local.ts` and `.env`) so you can fork or push this repository cleanly without exposing personal details:

```bash
cp vitepaper.local.example.ts vitepaper.local.ts
cp .env.example .env
```

* Edit `vitepaper.local.ts` to customize your blog title, tagline, Iconify logo (e.g. `'majesticons:door-exit'`), social links, and Outline collection/folder names.
* Edit `.env` and set your `OUTLINE_API_KEY` and `OUTLINE_WEBHOOK_SECRET`.

### 2. Sync & Preview Locally

```bash
# Install dependencies
pnpm install

# Sync from your Outline 'Published' folder
pnpm sync

# Or sync from your Outline 'Drafts' folder for local previewing
pnpm sync:drafts

# Start the VitePress dev server (http://localhost:5173)
pnpm docs:dev
```

---

## Self-Hosting with Docker Compose

A pre-built generic image is published automatically to GitHub Container Registry (`ghcr.io`) via [.github/workflows/docker-publish.yml](./.github/workflows/docker-publish.yml).

### 1. Prepare Your Homelab Directory
Create a directory on your Docker host containing:
* `docker-compose.yml`
* `.env` (with `OUTLINE_URL`, `OUTLINE_API_KEY`, `OUTLINE_WEBHOOK_SECRET`, plus either `vitepaper.local.ts` mounted as a volume or `SITE_*` environment variables)

```yaml
services:
  vitepaper:
    image: ghcr.io/jcktwd/vitepaper:latest
    container_name: vitepaper-blog
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      # Optional: mount your personal vitepaper.local.ts config
      - ./vitepaper.local.ts:/app/vitepaper.local.ts:ro
      # Persist synced Markdown & downloaded Outline attachments across container restarts
      - ./data/posts:/app/content/posts
      - ./data/attachments:/app/content/public/attachments
```

### 2. Start the Container
```bash
docker compose up -d
```
On startup, the container automatically runs `pnpm sync && pnpm docs:build` against your Outline instance and starts listening on port `3000` (with healthcheck at `GET /api/health`).

### 3. Configure the Outline Webhook
In your Outline workspace (**Settings → Webhooks → New webhook**):
* **Name**: `VitePaper Blog`
* **URL**: `https://<your-blog-domain>/api/webhook/outline` *(or `http://vitepaper-blog:3000/api/webhook/outline` if on the same internal Docker network)*
* **Events**: Select `documents.publish`, `documents.unpublish`, `documents.update`, `documents.move`, `documents.archive`, and `documents.delete`.
* Copy the generated **Signing Secret** into `OUTLINE_WEBHOOK_SECRET` in your `.env`.
