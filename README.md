# Webadi: Portfolio

Password-protected portfolio site for Webadi, a digital design studio.

## Public homepage vs. private portfolio

`index.html` has two parts:

- **Public homepage** (in `src/shell.html`): studio name, services, client types,
  why Webadi, and Instagram contact. This is plain HTML that Google can index, with
  SEO metadata, Open Graph tags and `ProfessionalService` structured data.
  `robots.txt` and `sitemap.xml` sit in the site root.
- **Private portfolio** (`src/content.html`): projects and team bios. It is
  **encrypted** with the access code (AES-256-GCM, key derived with PBKDF2-SHA256)
  at build time. "View portfolio" opens the access screen; the correct code replaces
  the homepage with the portfolio, and it stays unlocked for that browser tab session
  ("Lock portfolio" in its footer returns to the homepage).

The access code is **not stored in this repo**. You pass it in at build time.

> Images in `assets/` are not encrypted. Anyone with a direct image URL can still open it.

## Editing the site

`src/content.html` is git-ignored so the plain-text content never ends up in this
public repo. On a fresh clone, recover it from the built site first:

```bash
WEBADI_CODE=yourcode node build.mjs unpack
```

1. Edit the content in `src/content.html` (projects, about, contact), styles in `styles.css`,
   and behavior/animations in `app.js`.
2. Rebuild `index.html` (requires Node 18+):

   ```bash
   WEBADI_CODE=yourcode node build.mjs
   ```

3. Commit the regenerated `index.html` along with your changes.

To preview locally, run `python3 -m http.server` in this folder and open
http://localhost:8000 (the decryption API needs `http://localhost` or HTTPS, not `file://`).

## Adding a project

Copy one of the `<article class="project">` blocks in `src/content.html`, then:
- Add a screenshot (`assets/<name>-preview.jpg`, 16:10 works best) and logo to `assets/`.
- Alternate `project--flip` to switch the image to the other side.
- Update the "live sites" count in the Work header.

## Structure

```
index.html          built output (public homepage + encrypted portfolio)
robots.txt          lets search engines crawl the site
sitemap.xml         page list for Google Search Console
styles.css          all styles and animations
app.js              access screen, decryption, scroll/hover animations
build.mjs           encrypts src/content.html into index.html
src/shell.html      public homepage + template for index.html
src/content.html    portfolio content (git-ignored; recreate with `build.mjs unpack`)
assets/             logos, screenshots, favicon, self-hosted Manrope font (OFL)
```
