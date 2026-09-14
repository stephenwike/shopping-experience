# shopping-experience

A Foundry module for the PF2e system containing pre-stocked shops, plus a static browser for viewing their inventory outside Foundry.

## Foundry module

The shop source files live in `src/packs`. Build the Foundry compendium packs with:

```powershell
npm install
npm run build
```

To export compendium data back to YAML, run:

```powershell
npm run extract
```

## Shop Ledger website

The React site reads the YAML shop records directly at build time. It includes shop selection, item search, type filters, stock levels, prices, and item details.

Run it locally:

```powershell
npm install
npm run web:dev
```

Open the local address Vite prints, usually `http://localhost:5173/`.

Create a production build with:

```powershell
npm run web:build
```

## Deployment

GitHub Pages is configured in `.github/workflows/deploy-pages.yml`. In the repository's GitHub settings, set **Pages** to deploy from **GitHub Actions**. Pushes to `main` then build and publish the website automatically.

For the `stephenwike/shopping-experience` fork, the public address is:

```text
https://stephenwike.github.io/shopping-experience/
```

The included `vercel.json` also supports deployment by importing the repository in the Vercel dashboard.
