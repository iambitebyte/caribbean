#!/bin/bash
set -e

# Caribbean Release Script
# Usage: ./release.sh [major|minor|patch] (default: patch)

SCOPE="@openclaw-caribbean"
PACKAGES=("packages/shared" "packages/protocol" "apps/server" "apps/agent")

# Parse arguments
BUMP_TYPE=${1:-patch}
case $BUMP_TYPE in
  major|minor|patch)
    ;;
  *)
    echo "❌ Invalid bump type: $BUMP_TYPE"
    echo "Usage: $0 [major|minor|patch]"
    echo "  major - x.0.0 (breaking changes)"
    echo "  minor - x.y.0 (new features)"
    echo "  patch - x.y.z (bug fixes, default)"
    exit 1
    ;;
esac

echo "🌴 Caribbean Release - $BUMP_TYPE bump"
echo "======================================"
echo ""

# Get current version from first package
CURRENT_VERSION=$(jq -r .version packages/shared/package.json)
echo "📍 Current version: $CURRENT_VERSION"
echo ""

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case $BUMP_TYPE in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
  patch)
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
esac

echo "🚀 New version: $NEW_VERSION"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi
echo ""

# Step 1: Bump versions
echo "📝 Step 1: Updating versions to $NEW_VERSION..."
for pkg in "${PACKAGES[@]}"; do
  echo "  $pkg"
  jq --arg v "$NEW_VERSION" '.version = $v' "$pkg/package.json" > tmp.json && mv tmp.json "$pkg/package.json"
done
echo "✅ Versions updated"
echo ""

# Step 2: Build in dependency order
echo "📦 Step 2: Building packages..."

echo "  [1/5] Building shared..."
cd packages/shared && pnpm run build && cd - > /dev/null

echo "  [2/5] Building protocol..."
cd packages/protocol && pnpm run build && cd - > /dev/null

echo "  [3/5] Building web..."
cd apps/web && pnpm run build && cd - > /dev/null

echo "  [4/5] Copying web to server..."
rm -rf apps/server/dist/web
mkdir -p apps/server/dist/web
cp -r apps/web/dist/* apps/server/dist/web/

echo "  [5/5] Building server..."
cd apps/server && pnpm run build && cd - > /dev/null

echo "  [6/6] Building agent..."
cd apps/agent && pnpm run build && cd - > /dev/null

echo "✅ Build complete"
echo ""

# Step 3: Publish to npm
echo "📤 Step 3: Publishing to npm..."
for pkg in "${PACKAGES[@]}"; do
  echo "  Publishing $pkg..."
  cd "$pkg"
  pnpm publish --access public --no-git-checks
  cd - > /dev/null
done
echo "✅ Published to npm"
echo ""

# Summary
echo "======================================"
echo "✅ Release complete!"
echo ""
echo "Published packages:"
for pkg in shared protocol server agent; do
  echo "  $SCOPE/$pkg@$NEW_VERSION"
done
echo ""
echo "Next steps:"
echo "  1. Commit changes: git add . && git commit -m 'chore: release $NEW_VERSION'"
echo "  2. Add git tag: git tag v$NEW_VERSION"
echo "  3. Push: git push && git push --tags"
echo ""
echo "Install on server:"
echo "  npm install -g $SCOPE/server@$NEW_VERSION $SCOPE/agent@$NEW_VERSION"
