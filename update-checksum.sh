#!/bin/bash

# Baklava Plugin Checksum Update Script
# Usage: ./update-checksum.sh <version> <checksum>
# Example: ./update-checksum.sh "0.2.5.0" "9aa8ec1ab15e965f59319c7e5a5e0ff3"

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <version> <checksum>"
    echo "Example: $0 \"0.2.5.0\" \"9aa8ec1ab15e965f59319c7e5a5e0ff3\""
    echo ""
    echo "To get the checksum for a release:"
    echo "  wget https://github.com/themaluxis/Baklava/releases/download/v<version>/baklava_<version>.zip"
    echo "  md5sum baklava_<version>.zip"
    exit 1
fi

VERSION="$1"
CHECKSUM="$2"

echo "Updating checksum for version $VERSION to $CHECKSUM"

# Update manifest.json - replace TO_BE_UPDATED_AFTER_RELEASE with the actual checksum for the specific version
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "/$VERSION/,/TO_BE_UPDATED_AFTER_RELEASE/s/TO_BE_UPDATED_AFTER_RELEASE/$CHECKSUM/" manifest.json
else
    # Linux
    sed -i "/$VERSION/,/TO_BE_UPDATED_AFTER_RELEASE/s/TO_BE_UPDATED_AFTER_RELEASE/$CHECKSUM/" manifest.json
fi

echo "✓ Checksum updated in manifest.json"
echo ""
echo "Next steps:"
echo "1. Review the change: git diff manifest.json"
echo "2. Commit: git add manifest.json && git commit -m \"Update checksum for v$VERSION\""
echo "3. Push: git push"
