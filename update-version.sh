#!/bin/bash

# Baklava Plugin Version Update Script
# Usage: ./update-version.sh <new_version> <changelog>
# Example: ./update-version.sh "0.2.6.0" "Added new feature for X"

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <version> <changelog>"
    echo "Example: $0 \"0.2.6.0\" \"Added new feature for X\""
    exit 1
fi

NEW_VERSION="$1"
CHANGELOG="$2"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
REPO_OWNER="themaluxis"
REPO_NAME="Baklava"

echo "Updating Baklava plugin to version $NEW_VERSION"
echo "Changelog: $CHANGELOG"
echo ""

# 1. Update AssemblyInfo.cs
echo "1. Updating Properties/AssemblyInfo.cs..."
cat > Properties/AssemblyInfo.cs <<EOF
using System.Reflection;

[assembly: AssemblyVersion("$NEW_VERSION")]
[assembly: AssemblyFileVersion("$NEW_VERSION")]
[assembly: AssemblyInformationalVersion("$NEW_VERSION")]
EOF

echo "   ✓ AssemblyInfo.cs updated to $NEW_VERSION"

# 2. Update manifest.json
echo "2. Updating manifest.json..."

# Create a temporary file with the new version entry
NEW_ENTRY=$(cat <<EOF
      {
        "version": "$NEW_VERSION",
        "changelog": "$CHANGELOG",
        "targetAbi": "10.11.0.0",
        "sourceUrl": "https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$NEW_VERSION/baklava_$NEW_VERSION.zip",
        "checksum": "TO_BE_UPDATED_AFTER_RELEASE",
        "checksumType": "md5",
        "timestamp": "$TIMESTAMP"
      },
EOF
)

# Use sed to insert the new entry after the "versions": [ line
# First, we need to escape special characters for sed
ESCAPED_ENTRY=$(echo "$NEW_ENTRY" | sed 's/[\/&]/\\&/g')

# For macOS and Linux compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "/\"versions\": \[/a\\
$ESCAPED_ENTRY
" manifest.json
else
    # Linux
    sed -i "/\"versions\": \[/a\\$NEW_ENTRY" manifest.json
fi

echo "   ✓ manifest.json updated with new version entry"
echo "   Note: Remember to update the checksum after creating the release!"

# 3. Show summary
echo ""
echo "============================================"
echo "Version Update Summary"
echo "============================================"
echo "New Version: $NEW_VERSION"
echo "Changelog: $CHANGELOG"
echo "Timestamp: $TIMESTAMP"
echo ""
echo "Next Steps:"
echo "1. Review the changes in AssemblyInfo.cs and manifest.json"
echo "2. Commit the changes: git add -A && git commit -m \"Bump version to $NEW_VERSION\""
echo "3. Create a git tag: git tag v$NEW_VERSION"
echo "4. Push changes and tag: git push && git push --tags"
echo "5. GitHub Actions will automatically create a release"
echo "6. After release, update the checksum in manifest.json"
echo "   - Download the release zip"
echo "   - Run: md5sum baklava_$NEW_VERSION.zip"
echo "   - Update the 'TO_BE_UPDATED_AFTER_RELEASE' value in manifest.json"
echo "============================================"
