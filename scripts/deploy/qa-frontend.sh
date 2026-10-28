#!/usr/bin/env bash
set -euo pipefail
: "${FRONTEND_BUCKET:?}" "${CLOUDFRONT_DISTRIBUTION_ID:?}" "${FRONTEND_URL:?}"
[[ "$FRONTEND_URL" == https://* ]] || { echo 'Frontend URL must use HTTPS'; exit 1; }
[[ -s dist/index.html ]] || { echo 'Missing production build'; exit 1; }
# Hashed assets first; index last. Retain old assets for clients with old HTML.
aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" --exclude index.html \
  --cache-control 'public,max-age=31536000,immutable' --exclude '*.map'
# Non-hashed public files must not stay cached for a year.
aws s3 cp dist/ "s3://$FRONTEND_BUCKET/" --recursive --exclude 'assets/*' --exclude index.html \
  --cache-control 'no-cache,max-age=0,must-revalidate'
aws s3 cp dist/index.html "s3://$FRONTEND_BUCKET/index.html" \
  --content-type 'text/html; charset=utf-8' --cache-control 'no-cache,max-age=0,must-revalidate'
invalidation=$(aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths '/*' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --id "$invalidation"
python3 - <<'PY'
import os, re, urllib.request, urllib.parse
base=os.environ['FRONTEND_URL'].rstrip('/')+'/'
with urllib.request.urlopen(base, timeout=30) as r:
    html=r.read().decode(); assert r.status == 200
scripts=re.findall(r'<script[^>]+src="([^"]+)"', html)
assert scripts, 'No application script in HTML'
for src in scripts:
    with urllib.request.urlopen(urllib.parse.urljoin(base,src), timeout=30) as r:
        assert r.status == 200 and 'text/html' not in r.headers.get('Content-Type',''), 'Missing JS asset'
print('QA HTML and JavaScript assets reachable through CloudFront.')
PY
