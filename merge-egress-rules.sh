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

# Merge max request body bytes
MAX_REQUEST_BODY=$(yq '.max_request_body_bytes // ""' "$EGRESS_RULES")
if [ -n "$MAX_REQUEST_BODY" ]; then
  yq -i ".proxy.max_request_body_bytes = $MAX_REQUEST_BODY" "$CONFIG"
fi

# Merge max response body bytes
MAX_RESPONSE_BODY=$(yq '.max_response_body_bytes // ""' "$EGRESS_RULES")
if [ -n "$MAX_RESPONSE_BODY" ]; then
  yq -i ".proxy.max_response_body_bytes = $MAX_RESPONSE_BODY" "$CONFIG"
fi

echo "=== Generated iron-proxy config ==="
cat "$CONFIG"
