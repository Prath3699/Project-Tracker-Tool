#!/bin/bash
# Smoke tests for the Issue Tracker backend (expects server running on :3000)
B=http://localhost:3000/api
echo "== bootstrap =="; curl -s $B/bootstrap | head -c 250; echo
echo "== create task =="; curl -s -X POST $B/tasks -H 'Content-Type: application/json' -d '{"name":"Backend smoke test task","urgency":"Critical","project":"api-docs"}'; echo
TID=$(curl -s "$B/tasks?q=backend%20smoke" | node -pe 'JSON.parse(require("fs").readFileSync(0)).pop().id')
echo "== patch task ($TID) =="; curl -s -X PATCH $B/tasks/$TID -d '{"progress":"Completed"}'; echo
echo "== invalid urgency (expect 400) =="; curl -s -o /dev/null -w '%{http_code}\n' -X PATCH $B/tasks/$TID -d '{"urgency":"Bogus"}'
echo "== filter project=api-docs =="; curl -s "$B/tasks?project=api-docs" | node -pe 'JSON.parse(require("fs").readFileSync(0)).map(t=>t.id).join(",")'
echo "== delete =="; curl -s -X DELETE $B/tasks/$TID; echo
echo "== prefs =="; curl -s -X PATCH $B/prefs -d '{"savedIds":["TSK-8"],"readFlags":{"inbox-1":true}}'; echo
echo "== channel msg =="; curl -s -X POST $B/channels/engineering -d '{"text":"hello from backend test"}'; echo
echo "== channel get =="; curl -s $B/channels/engineering; echo
echo "== board reorder =="; curl -s -X PATCH $B/board -d '{"order":["TSK-20","TSK-8"]}'; echo
echo "== bad reorder id (expect 400) =="; curl -s -o /dev/null -w '%{http_code}\n' -X PATCH $B/board -d '{"order":["NOPE"]}'
echo "== unknown endpoint (expect 404) =="; curl -s -o /dev/null -w '%{http_code}\n' $B/nope
echo "== static index (expect 200 html) =="; curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3000/index.html
echo "== path traversal (expect non-200) =="; curl -s -o /dev/null -w '%{http_code}\n' --path-as-is "http://localhost:3000/../etc/passwd"
echo "== persistence check: db.json exists =="; ls -la /workspace/data/db.json
