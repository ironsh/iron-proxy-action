#!/usr/bin/env bash
set -euo pipefail

# Merges user egress rules into the iron-proxy config.
# Usage: merge-egress-rules.sh <egress-rules.yaml> <iron-proxy.yaml>
#
# The egress rules file can contain:
#   domains: [...]   - simple domain allowlist
#   cidrs: [...]     - simple CIDR allowlist
#   rules: [...]     - fine-grained rules with method/path restrictions
#
# These get merged into the allowlist transform config in the iron-proxy config.

EGRESS_RULES="$1"
CONFIG="$2"

# Merge domains from egress rules into the allowlist transform
DOMAINS=$(yq -o=json '.domains // []' "$EGRESS_RULES")
if [ "$DOMAINS" != "[]" ]; then
  yq -i ".transforms[0].config.domains += $DOMAINS" "$CONFIG"
fi

# Merge cidrs
CIDRS=$(yq -o=json '.cidrs // []' "$EGRESS_RULES")
if [ "$CIDRS" != "[]" ]; then
  yq -i ".transforms[0].config.cidrs += $CIDRS" "$CONFIG"
fi

# Merge rules
RULES=$(yq -o=json '.rules // []' "$EGRESS_RULES")
if [ "$RULES" != "[]" ]; then
  yq -i ".transforms[0].config.rules += $RULES" "$CONFIG"
fi

echo "=== Generated iron-proxy config ==="
cat "$CONFIG"
