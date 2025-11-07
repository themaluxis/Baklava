#!/usr/bin/env bash
# release_exact.sh
# Reproduces the exact sequence performed interactively:
# 1. Build project
# 2. Remove Baklava_0.1.4.zip from git & remote (git rm, commit, push)
# 3. Create Baklava_0.1.4.zip from publish/
# 4. Compute MD5
# 5. Update manifest.json checksum/timestamp/sourceUrl
# 6. Add new zip + manifest, commit and push

set -euo pipefail

# Absolute repository root (adjust if you moved repository)
REPO_ROOT="/home/j4ckgrey/zilean/jellyfin-plugin-baklava"
ZIPNAME="Baklava_0.1.4.zip"
MANIFEST="$REPO_ROOT/manifest.json"
GIT_REMOTE="origin"
GIT_BRANCH="main"

echo "[release_exact] Repo root: $REPO_ROOT"
echo "[release_exact] Zip: $ZIPNAME"

cd "$REPO_ROOT"

echo "[release_exact] 1) Building project (dotnet build -c Debug)"
dotnet build -c Debug

echo "[release_exact] 2) Remove existing $ZIPNAME from git & remote if tracked"
if git ls-files --error-unmatch "$ZIPNAME" >/dev/null 2>&1; then
  git rm -f "$ZIPNAME"
  git commit -m "chore(release): remove existing $ZIPNAME before recreating"
  git push "$GIT_REMOTE" "$GIT_BRANCH"
else
  echo "[release_exact] $ZIPNAME not tracked in git index — skipping git rm"
fi

echo "[release_exact] 3) Create new zip from publish/"
if [ ! -d "$REPO_ROOT/publish" ]; then
  echo "ERROR: publish/ directory not found at $REPO_ROOT/publish" >&2
  exit 1
fi
echo "[release_exact] Sync repository Files/ -> publish/Files/ to ensure wwwroot is up-to-date"
mkdir -p "$REPO_ROOT/publish/Files"
rsync -a --delete "$REPO_ROOT/Files/" "$REPO_ROOT/publish/Files/"

cd "$REPO_ROOT/publish"
zip -r "$REPO_ROOT/$ZIPNAME" .
cd "$REPO_ROOT"

echo "[release_exact] 4) Compute MD5"
MD5_FULL=$(md5sum "$ZIPNAME")
MD5=$(echo "$MD5_FULL" | awk '{print $1}')
echo "[release_exact] md5: $MD5"

echo "[release_exact] 5) Update $MANIFEST with new checksum/timestamp/sourceUrl"
TS=$(python3 - <<PY
import datetime
print(datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z')
PY
)

python3 - <<PY
import json
f='$MANIFEST'
with open(f,'r',encoding='utf-8') as fh:
    d=json.load(fh)
for v in d[0].get('versions',[]):
    if v.get('version')=='0.1.4':
        v['checksum']= '$MD5'
        v['timestamp']= '$TS'
        v['sourceUrl']='https://raw.githubusercontent.com/j4ckgrey/jellyfin-plugin-baklava/main/' + '$ZIPNAME'
        break
with open(f,'w',encoding='utf-8') as fh:
    json.dump(d,fh,indent=2)
print('manifest.json updated')
PY

echo "[release_exact] 6) Add new zip and manifest, commit and push"
git add "$ZIPNAME" "$MANIFEST"
git commit -m "chore(release): add new $ZIPNAME and update manifest checksum/timestamp"
git push "$GIT_REMOTE" "$GIT_BRANCH"

echo "[release_exact] Done — md5=$MD5"
