# Orientación Olavarría

Sitio de Pablo Ciocchini, psicólogo: orientación vocacional y ocupacional en Olavarría. Páginas de perfil + blog.

Producción: https://orientacionolavarria.com.ar

## Stack

- [Astro](https://astro.build) (salida estática) + `@astrojs/sitemap`
- Sveltia CMS en `/admin/` (backend GitHub)
- Cloudflare Workers (static assets desde `dist/`, builds conectados a Git)

## Desarrollo local (Docker, sin Node en el host)

```sh
docker run --rm -v "$PWD":/app -w /app node:lts npm install
docker run --rm -it -p 4321:4321 -v "$PWD":/app -w /app node:lts npm run dev -- --host   # http://localhost:4321
docker run --rm -v "$PWD":/app -w /app node:lts npm run check
docker run --rm -v "$PWD":/app -w /app node:lts npm run build   # genera dist/
```

## Estructura

- `src/pages/`: páginas (`/`, `/proceso/`, `/sobre-mi/`, `/contacto/`, `/blog/`, `/blog/<slug>/`, 404)
- `src/layouts/BaseLayout.astro`: `<head>`, nav y footer
- `src/content/blog/`: artículos en Markdown (esquema en `src/content.config.ts`)
- `src/styles/global.css`: estilos
- `public/`: archivos estáticos; imágenes del blog en `public/img/blog/`

## Cómo se publica un artículo

1. Pablo escribe en `/admin/` (Sveltia CMS).
2. Al publicar, el CMS hace un commit en GitHub con `src/content/blog/<slug>.md` (e imágenes en `public/img/blog/`).
3. Cloudflare detecta el commit, corre `npm run build` y publica `dist/`.

Los artículos con `draft: true` no se publican.
