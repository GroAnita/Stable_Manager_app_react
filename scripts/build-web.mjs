// Website build only. The iPhone app needs dist/index.html to be the app, so
// `npm run build` stays as it is and this swaps the files afterwards:
// the landing page answers at /, and every other address gets the app.
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

const canonical = /<link rel="canonical"[^>]*>/
const app = readFileSync('dist/index.html', 'utf8')
if (!canonical.test(app))
  throw new Error('No canonical tag found in the app page')

// Login pages shouldn't compete with the landing page in search results.
writeFileSync(
  'dist/app.html',
  app.replace(canonical, '<meta name="robots" content="noindex" />'),
)
renameSync('dist/landing.html', 'dist/index.html')
