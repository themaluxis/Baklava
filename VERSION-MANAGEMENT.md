# Baklava Plugin - Version Management Guide

This guide explains how to manage versions and releases for the Baklava Jellyfin plugin.

## Overview

The Baklava plugin uses a version management system that keeps track of:
- **Assembly Version** (in `Properties/AssemblyInfo.cs`)
- **Plugin Manifest** (in `manifest.json`)
- **GitHub Releases** (automatically created by GitHub Actions)

## Files Involved

1. **`Properties/AssemblyInfo.cs`** - Contains the assembly version information
2. **`manifest.json`** - Contains the plugin metadata and version history for Jellyfin's plugin repository
3. **`.github/workflows/build.yml`** - Automatically builds and releases the plugin

## Version Format

We use semantic versioning with 4 parts: `MAJOR.MINOR.PATCH.BUILD`

Example: `0.2.5.0`
- **MAJOR** (0): Major version, incremented for breaking changes
- **MINOR** (2): Minor version, incremented for new features
- **PATCH** (5): Patch version, incremented for bug fixes
- **BUILD** (0): Build number (usually 0)

## Creating a New Version

### Option 1: Using the Automated Script (Recommended)

```bash
# Update to a new version
./update-version.sh "0.2.6.0" "Fixed authentication bug and improved performance"

# Review changes
git diff

# Commit and create tag
git add -A
git commit -m "Bump version to 0.2.6.0"
git tag v0.2.6.0

# Push changes and tag
git push && git push --tags
```

The GitHub Actions workflow will automatically:
1. Build the plugin
2. Create a release with tag `v0.2.6.0`
3. Upload the built plugin as `baklava_0.2.6.0.zip`

### Option 2: Manual Update

1. **Update `Properties/AssemblyInfo.cs`**:
   ```csharp
   [assembly: AssemblyVersion("0.2.6.0")]
   [assembly: AssemblyFileVersion("0.2.6.0")]
   [assembly: AssemblyInformationalVersion("0.2.6.0")]
   ```

2. **Update `manifest.json`**: Add a new entry at the TOP of the `versions` array:
   ```json
   {
     "version": "0.2.6.0",
     "changelog": "Your changelog here",
     "targetAbi": "10.11.0.0",
     "sourceUrl": "https://github.com/themaluxis/Baklava/releases/download/v0.2.6.0/baklava_0.2.6.0.zip",
     "checksum": "TO_BE_UPDATED_AFTER_RELEASE",
     "checksumType": "md5",
     "timestamp": "2025-11-15T12:00:00Z"
   }
   ```

3. **Commit and tag**:
   ```bash
   git add -A
   git commit -m "Bump version to 0.2.6.0"
   git tag v0.2.6.0
   git push && git push --tags
   ```

## Updating Checksums After Release

After GitHub Actions creates the release:

```bash
# Download the release
wget https://github.com/themaluxis/Baklava/releases/download/v0.2.6.0/baklava_0.2.6.0.zip

# Calculate MD5 checksum
md5sum baklava_0.2.6.0.zip
# Output: 9aa8ec1ab15e965f59319c7e5a5e0ff3  baklava_0.2.6.0.zip

# Update the checksum using the script
./update-checksum.sh "0.2.6.0" "9aa8ec1ab15e965f59319c7e5a5e0ff3"

# Commit and push
git add manifest.json
git commit -m "Update checksum for v0.2.6.0"
git push
```

Or update manually in `manifest.json`:
```json
"checksum": "9aa8ec1ab15e965f59319c7e5a5e0ff3",
```

## Installing from the Manifest

### For Users

1. In Jellyfin, go to **Dashboard** → **Plugins** → **Repositories**
2. Add a new repository:
   - **Repository Name**: Baklava
   - **Repository URL**: `https://raw.githubusercontent.com/themaluxis/Baklava/main/manifest.json`
3. Go to **Catalog** and install/update Baklava

### For Developers (Testing)

If you want to test a development version:
1. Push your changes to a branch
2. The workflow will create an auto-release (e.g., `auto-24`)
3. Temporarily update `manifest.json` to point to the auto-release:
   ```json
   "sourceUrl": "https://github.com/themaluxis/Baklava/releases/download/auto-24/baklava-24.zip"
   ```

## Workflow Summary

```
1. Make code changes
2. Run: ./update-version.sh "X.Y.Z.0" "Changelog message"
3. Review changes: git diff
4. Commit: git add -A && git commit -m "Bump version to X.Y.Z.0"
5. Tag: git tag vX.Y.Z.0
6. Push: git push && git push --tags
7. Wait for GitHub Actions to build and release
8. Download release and calculate checksum
9. Run: ./update-checksum.sh "X.Y.Z.0" "<checksum>"
10. Commit: git add manifest.json && git commit -m "Update checksum for vX.Y.Z.0"
11. Push: git push
```

## Troubleshooting

### Checksum doesn't match
- Ensure you downloaded the exact file from the GitHub release
- Use `md5sum` on Linux/macOS or `certutil -hashfile <file> MD5` on Windows
- Make sure you copied the full checksum (32 hex characters)

### Plugin won't install from manifest
- Check that the `sourceUrl` is correct and accessible
- Verify the `targetAbi` matches your Jellyfin server version
- Ensure the checksum is correct

### Version already exists
If you need to replace a version:
1. Delete the tag: `git tag -d v0.2.6.0 && git push origin :refs/tags/v0.2.6.0`
2. Delete the GitHub release manually
3. Update the version and re-create the release

## Current Version

Current version: **0.2.5.0**

Last updated: 2025-11-15
