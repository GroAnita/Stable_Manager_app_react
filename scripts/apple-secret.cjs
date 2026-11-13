// Makes the secret key Supabase needs for Sign in with Apple on the web, and puts
// it on the clipboard without printing it. Apple allows at most 6 months.
// Usage: node scripts/apple-secret.cjs <path to .p8> <Key ID>
// Keep the .p8 file outside the project; it must never be committed.
const crypto = require('crypto')
const fs = require('fs')
const { execSync } = require('child_process')

const [, , p8Path, keyId] = process.argv
if (!p8Path || !keyId || /LIM_INN/.test(p8Path + keyId)) {
  console.error('Bruk: node scripts/apple-secret.cjs <sti til .p8-filen> <Key ID>')
  process.exit(1)
}

const TEAM_ID = 'TUJX466264'
const CLIENT_ID = 'no.nestundigital.stallorg.web'
const now = Math.floor(Date.now() / 1000)
const expires = now + 180 * 24 * 60 * 60 // 180 days, under Apple's limit

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const header = encode({ alg: 'ES256', kid: keyId.trim() })
const payload = encode({
  iss: TEAM_ID,
  iat: now,
  exp: expires,
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
})
const signature = crypto
  .sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: fs.readFileSync(p8Path.trim(), 'utf8'),
    dsaEncoding: 'ieee-p1363',
  })
  .toString('base64url')

execSync('pbcopy', { input: `${header}.${payload}.${signature}` })
const date = new Date(expires * 1000).toLocaleDateString('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
console.log(`Nøkkelen er kopiert til utklippstavlen. Den utløper ${date}.`)
