#!/bin/bash
# Makes the upload key that signs StallOrg's Android app for Google Play, and
# writes android/keystore.properties so the build can use it. Run once, from
# the project folder:
#   bash scripts/make-android-upload-key.sh
# You choose a password (nothing shows while you type). Neither the key nor
# the password is committed to git.
#
# KEEP A COPY of ~/StallOrg-nøkler/stallorg-upload.jks and the password
# somewhere safe (a password manager). Google can reset a lost upload key,
# but it takes days and stops updates until then.

set -e
cd "$(dirname "$0")/.."

KEYDIR="$HOME/StallOrg-nøkler"
KEYFILE="$KEYDIR/stallorg-upload.jks"
KEYTOOL="/opt/homebrew/opt/openjdk@21/bin/keytool"

if [ -f "$KEYFILE" ]; then
  echo "Nøkkelen finnes allerede ($KEYFILE). Ingenting er endret."
  exit 1
fi

printf "Velg et passord for nøkkelen (minst 8 tegn) og trykk Enter: "
read -rs PASS
echo
printf "Skriv det samme passordet en gang til: "
read -rs PASS2
echo

if [ "$PASS" != "$PASS2" ]; then
  echo "Passordene var ikke like. Ingenting er laget."
  exit 1
fi
if [ ${#PASS} -lt 8 ]; then
  echo "Passordet må ha minst 8 tegn. Ingenting er laget."
  exit 1
fi

if [[ "$PASS" == *\\* ]]; then
  echo "Passordet kan ikke inneholde \\ (skråstrek bakover). Ingenting er laget."
  exit 1
fi

mkdir -p "$KEYDIR"
STORE_PASS="$PASS" "$KEYTOOL" -genkeypair -v \
  -keystore "$KEYFILE" -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass:env STORE_PASS -keypass:env STORE_PASS \
  -dname "CN=Nestun Digital Braathen, O=Nestun Digital Braathen, C=NO" >/dev/null

umask 077
cat > android/keystore.properties <<EOF
storeFile=$KEYFILE
storePassword=$PASS
keyAlias=upload
keyPassword=$PASS
EOF

unset PASS PASS2
echo "Laget: $KEYFILE"
echo "Ta en kopi av den filen og passordet nå (f.eks. i passordbehandleren din)."
