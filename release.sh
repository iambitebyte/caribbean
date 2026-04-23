#!/bin/bash
set -e

# Caribbean Release Script using Changesets
# This script handles version bumping, building, and publishing

SCOPE="@openclaw-caribbean"
PUBLISHED_PACKAGES=("shared" "protocol" "server" "agent")

echo "🌴 Caribbean Release Workflow"
echo "================================"
echo ""

# Check if there are changesets to consume
if [ -z "$(ls .changeset/*.md 2>/dev/null | grep -v README)" ]; then
  echo "❌ No changesets found. Create one first with:"
  echo "   pnpm changeset"
  exit 1
fi

echo "📋 Current changesets:"
ls -1 .changeset/*.md 2>/dev/null | grep -v README | while read f; do
  echo "  - $(basename "$f")"
done
echo ""

# Step 1: Update versions based on changesets
echo "📝 Step 1: Updating package versions..."
pnpm changeset version
echo "✅ Versions updated"
echo ""

# Step 2: Show version changes
echo "📊 Version changes:"
git diff --stat package.json apps/*/package.json packages/*/package.json | grep -E "version|package.json" || true
echo ""

# Optional: Ask if user wants to review changes
read -p "🔍 Review changes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git diff package.json apps/*/package.json packages/*/package.json
  echo ""
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted"
    exit 1
  fi
fi

# Step 3: Build all packages in order
echo "📦 Step 2: Building packages..."

echo "  [1/5] Building @openclaw-caribbean/shared..."
cd packages/shared && pnpm run build && cd - > /dev/null

echo "  [2/5] Building @openclaw-caribbean/protocol..."
cd packages/protocol && pnpm run build && cd - > /dev/null

echo "  [3/5] Building web dashboard..."
cd apps/web && pnpm run build && cd - > /dev/null

echo "  [4/5] Embedding web into server..."
rm -rf apps/server/dist/web
mkdir -p apps/server/dist/web
cp -r apps/web/dist/* apps/server/dist/web/

echo "  [5/5] Building @openclaw-caribbean/server..."
cd apps/server && pnpm run build && cd - > /dev/null

echo "  [6/6] Building @openclaw-caribbean/agent..."
cd apps/agent && pnpm run build && cd - > /dev/null

echo "✅ Build complete"
echo ""

# Step 4: Publish to npm
echo "📤 Step 3: Publishing to npm..."
echo "Packages to publish:"
for pkg in "${PUBLISHED_PACKAGES[@]}"; do
  if [ "$pkg" = "shared" ] || [ "$pkg" = "protocol" ]; then
    echo "  - packages/$pkg"
  else
    echo "  - apps/$pkg"
  fi
done
echo ""

pnpm changeset publish
echo "✅ Published to npm"
echo ""

# Step 5: Cleanup consumed changesets
echo "🧹 Step 4: Cleaning up..."
echo "Consumed changeset files will be removed on next commit"
echo ""

# Summary
echo "================================"
echo "✅ Release complete!"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Commit changes: git add . && git commit -m 'chore: release X.Y.Z'"
echo "  3. Push to GitHub: git push"
echo ""
echo "Published packages:"
for pkg in "${PUBLISHED_PACKAGES[@]}"; do
  version=$(node -e "console.log(require('./$(echo "$pkg" | sed 's|shared|packages/shared|;s|protocol|packages/protocol|;s|server|apps/server|;s|agent|apps/agent|')/package.json').version)")
  echo "  $SCOPE/$pkg@$version"
done
echo ""
echo "Install on server:"
echo "  npm install -g $SCOPE/server@latest $SCOPE/agent@latest"
