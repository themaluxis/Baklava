#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# release.sh - Automate Baklava release workflow
# Usage: ./release.sh [version] [changelog]
# If no args provided, the script will prompt interactively.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASSEMBLY_FILE="$ROOT_DIR/Properties/AssemblyInfo.cs"
MANIFEST_FILE="$ROOT_DIR/manifest.json"
PUBLISH_DIR="$ROOT_DIR/bin/Release/net9.0/publish"

# Check required commands
require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command '$1' not found. Please install it." >&2; exit 1; }
}

require git
require dotnet
require zip
require md5sum
require python3
require gh

# Helpers
prompt_confirm() {
  local msg="$1"
  read -r -p "$msg [y/N]: " ans
  case "$ans" in
    [Yy]|[Yy][Ee][Ss]) return 0 ;; 
    *) return 1 ;;
  esac
}

# Read args or prompt
VERSION="${1:-}" 
CHANGELOG="${2:-}"

if [ -z "$VERSION" ]; then
  read -r -p "Enter new version (eg 0.1.8): " VERSION
fi

if [ -z "$CHANGELOG" ]; then
  echo "Enter changelog (end with EOF on its own line):"
  CHANGELOG=""
  while IFS= read -r line; do
    if [ "$line" = "EOF" ]; then break; fi
    CHANGELOG+="$line\n"
  done
fi

if [ -z "$VERSION" ] || [ -z "$CHANGELOG" ]; then
  echo "Version and changelog are required." >&2
  exit 1
fi

SHORT_CHANGELOG=$(echo "$CHANGELOG" | sed -n '1p' | sed -E 's/"/\"/g')

# Ensure git working tree is clean
if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "Working tree is not clean. Commit or stash changes before running this script." >&2
  git -C "$ROOT_DIR" status --short
  exit 1
fi

# Backup files
cp -v "$ASSEMBLY_FILE" "$ASSEMBLY_FILE.bak"
cp -v "$MANIFEST_FILE" "$MANIFEST_FILE.bak"

# Update AssemblyInfo.cs
echo "Updating $ASSEMBLY_FILE to version $VERSION"
# Compose assembly versions: AssemblyVersion and FileVersion are X.Y.Z.0
ASM_VER="${VERSION}.0"
python3 - <<PY
from pathlib import Path
p=Path(r'''$ASSEMBLY_FILE''')
s=p.read_text()
s=s
import re
s=re.sub(r'\[assembly: AssemblyVersion\("[^"]+"\)\]', f'[assembly: AssemblyVersion("{ASM_VER}")]', s)
s=re.sub(r'\[assembly: AssemblyFileVersion\("[^"]+"\)\]', f'[assembly: AssemblyFileVersion("{ASM_VER}")]', s)
s=re.sub(r'\[assembly: AssemblyInformationalVersion\("[^"]+"\)\]', f'[assembly: AssemblyInformationalVersion("{VERSION}")]', s)
p.write_text(s)
print('AssemblyInfo updated')
PY

# Prepare manifest: insert new top-level version entry with placeholder checksum
# Build sourceUrl dynamically from git remote
REMOTE_URL=$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE_URL" ]; then
  echo "Could not find git remote origin URL. Using github.com/j4ckgrey/Baklava as fallback."
  OWNER_REPO="j4ckgrey/Baklava"
else
  # parse owner/repo from remote (supports git@ and https)
  if [[ "$REMOTE_URL" =~ github.com[:/](.+)\.git$ ]]; then
    OWNER_REPO=${BASH_REMATCH[1]}
  else
    OWNER_REPO="j4ckgrey/Baklava"
  fi
fi
SOURCE_URL="https://github.com/${OWNER_REPO}/releases/download/v${VERSION}/baklava_${VERSION}.zip"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

python3 - <<PY
import json, sys
p='''$MANIFEST_FILE'''
with open(p,'r',encoding='utf-8') as f:
    data=json.load(f)
root=data[0]
versions=root.get('versions', [])
# check for existing
for v in versions:
    if v.get('version')=="$VERSION":
        print('Version already exists in manifest:', file=sys.stderr)
        sys.exit(2)
new_entry={
    'version': "$VERSION",
    'changelog': "$CHANGELOG",
    'targetAbi': versions[0].get('targetAbi','10.11.0.0') if versions else '10.11.0.0',
    'sourceUrl': "$SOURCE_URL",
    'checksum': 'PLACEHOLDER',
    'checksumType': 'md5',
    'timestamp': "$TIMESTAMP"
}
versions.insert(0,new_entry)
root['versions']=versions
with open(p,'w',encoding='utf-8') as f:
    json.dump(data,f,indent=2,ensure_ascii=False)
print('Inserted new manifest entry for',"$VERSION")
PY

# Build
echo "Running dotnet publish -c Release"
dotnet publish -c Release

# Create zip
PUBLISH_DIR="$PUBLISH_DIR"
ZIP_NAME="baklava_${VERSION}.zip"
ZIP_PATH="$PUBLISH_DIR/$ZIP_NAME"
cd "$PUBLISH_DIR"
rm -f "$ZIP_NAME"
zip -r "$ZIP_NAME" * -x "*.pdb" -x "baklava_*.zip"
cd "$ROOT_DIR"

# Compute md5
MD5=$(md5sum "$ZIP_PATH" | awk '{print $1}')
echo "MD5: $MD5"

# Update manifest checksum for this version
python3 - <<PY
import json
p='''$MANIFEST_FILE'''
with open(p,'r',encoding='utf-8') as f:
    data=json.load(f)
root=data[0]
versions=root.get('versions',[])
for v in versions:
    if v.get('version')=="$VERSION":
        v['checksum']='$MD5'
        break
else:
    print('Could not find version entry in manifest to update checksum',file=sys.stderr)
    sys.exit(1)
with open(p,'w',encoding='utf-8') as f:
    json.dump(data,f,indent=2,ensure_ascii=False)
print('Updated manifest checksum')
PY

# Commit, tag and push
git -C "$ROOT_DIR" add "$ASSEMBLY_FILE" "$MANIFEST_FILE"
COMMIT_MSG="v$VERSION: $SHORT_CHANGELOG"
git -C "$ROOT_DIR" commit -m "$COMMIT_MSG"
# create tag
git -C "$ROOT_DIR" tag -f "v$VERSION"

echo "Pushing commits and tag to origin"
git -C "$ROOT_DIR" push origin HEAD
git -C "$ROOT_DIR" push origin --tags --force

# Create github release
RELEASE_NOTES="$CHANGELOG"
gh release create "v$VERSION" "$ZIP_PATH" "$MANIFEST_FILE" --title "Baklava v$VERSION" --notes "$RELEASE_NOTES"

echo "Release v$VERSION created successfully."

echo "Done."
