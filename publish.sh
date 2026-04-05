#!/bin/bash
set -e

VERSION=${1:?Usage: $0 <version>  (e.g., $0 0.1.5)}
SCOPE="@openclaw-caribbean"
PACKAGES=("packages/shared" "packages/protocol" "apps/server" "apps/agent")

echo "🚀 Publishing $SCOPE packages v$VERSION"
echo "========================================"

# Step 1: Bump versions
echo ""
echo "📝 Step 1: Updating versions to $VERSION..."
for pkg in "${PACKAGES[@]}"; do
  echo "  $pkg"
  cd "$pkg"
  jq --arg v "$VERSION" '.version = $v' package.json > tmp.json && mv tmp.json package.json
  cd - > /dev/null
done

# Step 2: Fix workspace dependencies (replace workspace:* with actual version)
echo ""
echo "🔧 Step 2: Fixing workspace dependencies..."
for pkg in "${PACKAGES[@]}"; do
  cd "$pkg"
  jq --arg v "$VERSION" '
    if .dependencies then
      .dependencies |= (
        to_entries | map(
          if .value == "workspace:*" then .value = ("^" + $v) else . end
        ) | from_entries
      )
    else . end
  ' package.json > tmp.json && mv tmp.json package.json
  cd - > /dev/null
done

# Step 3: Build in dependency order
echo ""
echo "📦 Step 3: Building packages..."

echo "  Building shared..."
cd packages/shared && pnpm run build && cd - > /dev/null

echo "  Building protocol..."
cd packages/protocol && pnpm run build && cd - > /dev/null

echo "  Building web..."
cd apps/web && pnpm run build && cd - > /dev/null

echo "  Copying web to server..."
rm -rf apps/server/dist/web
mkdir -p apps/server/dist/web
cp -r apps/web/dist/* apps/server/dist/web/

echo "  Building server..."
cd apps/server && pnpm run build && cd - > /dev/null

echo "  Building agent..."
cd apps/agent && pnpm run build && cd - > /dev/null

# Step 4: Publish in dependency order
echo ""
echo "📤 Step 4: Publishing packages..."
for pkg in "${PACKAGES[@]}"; do
  echo "  Publishing $pkg..."
  cd "$pkg"
  pnpm publish --access public --no-git-checks
  cd - > /dev/null
done

# Step 5: Revert workspace dependencies for local development
echo ""
echo "🔄 Step 5: Reverting workspace dependencies..."
for pkg in "${PACKAGES[@]}"; do
  cd "$pkg"
  jq '
    if .dependencies then
      .dependencies |= (
        to_entries | map(
          if .key | startswith("@openclaw-caribbean/") then .value = "workspace:*" else . end
        ) | from_entries
      )
    else . end
  ' package.json > tmp.json && mv tmp.json package.json
  cd - > /dev/null
done

echo ""
echo "✅ All packages published as v$VERSION!"
echo ""
echo "  $SCOPE/shared@$VERSION"
echo "  $SCOPE/protocol@$VERSION"
echo "  $SCOPE/server@$VERSION"
echo "  $SCOPE/agent@$VERSION"
echo ""
echo "Update on server:"
echo "  sudo npm install -g $SCOPE/server@latest $SCOPE/agent@latest"