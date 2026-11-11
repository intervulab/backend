#!/usr/bin/env bash
# Quick HTTP spine check: auth → session → text answer → report
set -euo pipefail

API="${API_BASE:-http://localhost:4000/api/v1}"
EMAIL="demo-spine-$(date +%s)@interviewlab.local"
PASS="DemoPass123!"

echo "==> Register"
REG=$(curl -sS -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"firstName\":\"Demo\",\"lastName\":\"Spine\",\"targetRole\":\"Backend Engineer\"}")
TOKEN=$(echo "$REG" | jq -r '.data.token')
if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
  echo "Register failed: $REG"
  exit 1
fi

echo "==> Create session"
SESS=$(curl -sS -X POST "$API/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo spine","targetRole":"Backend Engineer"}')
SESSION_ID=$(echo "$SESS" | jq -r '.data.id')
QUESTION_ID=$(echo "$SESS" | jq -r '.data.questions[0].id')
echo "Session $SESSION_ID question $QUESTION_ID"

echo "==> Submit text answer"
ANS=$(curl -sS -X POST "$API/questions/$QUESTION_ID/answer" \
  -H "Authorization: Bearer $TOKEN" \
  -F "transcriptText=I would use a token bucket in Redis with sliding windows for rate limiting and trade-off burst vs fairness.")
echo "$ANS" | jq '.data.answer.evaluation, .data.realTimeMetrics'

echo "==> Generate report"
REP=$(curl -sS -X POST "$API/sessions/$SESSION_ID/report" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$REP" | jq '.data.overallScore, .data.recommendation'

echo "==> Spine OK"
