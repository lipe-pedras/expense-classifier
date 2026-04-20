#!/usr/bin/env bash
# Integration test runner — brings up the dev stack, runs DB/Redis/Ollama
# integration tests for API and worker, tears down with volumes.
#
# Exits with the OR of both test-suite exit codes so CI fails if either fails.

set -u
set -o pipefail

COMPOSE="docker compose -f docker-compose.dev.yml"

wait_for() {
  local name="$1"
  local timeout="$2"
  local cmd="$3"
  local elapsed=0
  echo "[integration] waiting for $name (timeout ${timeout}s)..."
  until eval "$cmd" >/dev/null 2>&1; do
    if (( elapsed >= timeout )); then
      echo "[integration] $name did not become ready in ${timeout}s" >&2
      return 1
    fi
    sleep 2
    elapsed=$(( elapsed + 2 ))
  done
  echo "[integration] $name is ready"
}

cleanup() {
  echo "[integration] tearing down"
  # Stop containers and remove the network, but NOT volumes — so ollama_dev_data
  # (the pulled model) persists across runs.
  $COMPOSE down
  # Wipe only the volumes that must be clean between runs.
  docker volume rm \
    new_ai_expense_postgres_dev_data \
    new_ai_expense_uploads_dev_data \
    new_ai_expense_easyocr_dev_cache \
    2>/dev/null || true
}
trap cleanup EXIT

echo "[integration] starting postgres, redis, ollama"
$COMPOSE up -d postgres redis ollama || exit 1

wait_for "postgres" 30 "$COMPOSE exec -T postgres pg_isready -U postgres" || exit 1
wait_for "redis" 15 "$COMPOSE exec -T redis redis-cli ping" || exit 1
wait_for "ollama" 60 "curl -sf http://localhost:11434/ -o /dev/null" || exit 1

echo "[integration] ensuring ollama model is pulled"
$COMPOSE exec -T ollama ollama pull qwen2.5:7b-instruct-q3_K_M || exit 1

echo "[integration] applying prisma migrations"
$COMPOSE run --rm api npx prisma migrate deploy || exit 1

echo "[integration] seeding test data"
$COMPOSE run --rm api npx prisma db seed || exit 1

echo "[integration] running TypeScript integration tests"
$COMPOSE run --rm \
  -e DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/expense_classifier}" \
  -e REDIS_URL=redis://redis:6379 \
  api npx vitest run --config vitest.integration.config.ts
TS_EXIT=$?

echo "[integration] running Python integration tests"
$COMPOSE run --rm \
  -e REDIS_URL=redis://redis:6379 \
  -e OLLAMA_URL=http://ollama:11434 \
  -e OLLAMA_MODEL=qwen2.5:7b-instruct-q3_K_M \
  worker pytest tests/integration/ -v -m integration
PY_EXIT=$?

echo "[integration] TS exit=$TS_EXIT  PY exit=$PY_EXIT"
exit $(( TS_EXIT | PY_EXIT ))
