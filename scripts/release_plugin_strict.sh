#!/usr/bin/env bash
# Strict release script: rebuild, zip, md5, update manifest, remove old zip from remote, add new zip, commit & push

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIPNAME="Baklava_0.1.4.zip"
MANIFEST="$REPO_ROOT/manifest.json"

echo "[release] Building project..."
dotnet build -c Debug

echo "[release] Creating zip from publish/..."
cd "$REPO_ROOT/publish"
zip -r "$REPO_ROOT/$ZIPNAME" .
cd "$REPO_ROOT"

MD5=$(md5sum "$ZIPNAME" | awk '{print $1}')
TS=$(python3 - <<PY
import datetime
print(datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z')
PY
)

echo "[release] MD5: $MD5"

echo "[release] Updating manifest.json"
python3 - <<PY
import json
f='manifest.json'
with open(f,'r',encoding='utf-8') as fh:
    d=json.load(fh)
for v in d[0].get('versions',[]):
    if v.get('version')=='0.1.4':
        v['checksum']= '$MD5'
        v['timestamp']= '$TS'
        v['sourceUrl']='https://raw.githubusercontent.com/j4ckgrey/jellyfin-plugin-baklava/main/'+ '$ZIPNAME'
        break
with open(f,'w',encoding='utf-8') as fh:
    json.dump(d,fh,indent=2)
print('manifest.json updated')
PY

echo "[release] Ensuring old zip is removed from git (if tracked)"
if git ls-files --error-unmatch "$ZIPNAME" >/dev/null 2>&1; then
    git rm -f "$ZIPNAME"
    git commit -m "chore(release): remove old $ZIPNAME before adding new"
    git push origin main
fi

echo "[release] Adding new zip and manifest to git"
git add "$ZIPNAME" "$MANIFEST"
git commit -m "chore(release): add new $ZIPNAME and update manifest checksum/timestamp"
git push origin main

echo "[release] Done. md5=$MD5"
