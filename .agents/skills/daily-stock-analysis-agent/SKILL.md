---
name: daily-stock-analysis-agent
description: Use the deployed Daily Stock Analysis (DSA) Web/API service as an agent tool for stock analysis, batch analysis, strategy chat, deep research, backtests, portfolio snapshots, history lookup, or wrapping DSA into another AI agent/HTTP skill/MCP-style tool. Trigger when the user asks an agent to interact with the running Docker/WebUI/API instance, call DSA endpoints, create an integration, or analyze stocks through DSA rather than by editing repository code.
---

# Daily Stock Analysis Agent

Use this skill when an AI agent should operate an already-running DSA service through HTTP. Follow repository rules in `AGENTS.md`; do not commit, tag, or push unless the user explicitly asks.

## Quick Decision

- Need a normal report for one stock: call `POST /api/v1/analysis/analyze`.
- Need many stocks: call `POST /api/v1/analysis/analyze` with `stock_codes` and `async_mode: true`, then poll task status.
- Need conversational strategy reasoning: call `POST /api/v1/agent/chat` or `POST /api/v1/agent/chat/stream`.
- Need a reusable external-agent integration: expose HTTP tools that wrap the DSA REST endpoints. DSA does not provide a native MCP server in this repo.
- Need exact request/response examples: read `references/api.md`.

## Base URL

Use `DSA_BASE_URL` if it is provided. Otherwise infer from the running service:

- Local Docker/WebUI: `http://127.0.0.1:8000`
- Remote Docker/WebUI: `http://<server-ip>:8000`

Check health first:

```bash
curl "$DSA_BASE_URL/api/health"
```

If `ADMIN_AUTH_ENABLED=true`, DSA API requests require the Web login session cookie; there is no Bearer token API in the current implementation.

## Workflows

### Analyze One Stock

Use synchronous mode only when the caller can wait several minutes:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/analysis/analyze" \
  -H 'Content-Type: application/json' \
  -d '{"stock_code":"600519","report_type":"detailed","force_refresh":true,"async_mode":false}'
```

Summarize `report.summary`, `report.strategy`, risks, and `query_id`. Keep financial output clearly non-advisory.

### Analyze A Batch

Use async mode for batches:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/analysis/analyze" \
  -H 'Content-Type: application/json' \
  -d '{"stock_codes":["600519","300750","hk00700","AAPL"],"async_mode":true,"report_type":"detailed","force_refresh":true}'
```

For each accepted task, poll:

```bash
curl "$DSA_BASE_URL/api/v1/analysis/status/<task_id>"
```

Handle `409 duplicate_task` by reporting that an analysis is already running.

### Strategy Chat

Use Agent chat when the user asks natural-language strategy questions:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/agent/chat" \
  -H 'Content-Type: application/json' \
  -d '{"message":"用缠论分析 600519，给出买点、止损和风险","skills":["chan_theory"],"session_id":"optional-session-id"}'
```

Use `/api/v1/agent/skills` to list valid skill IDs before selecting strategies. Common built-ins include `bull_trend`, `chan_theory`, `wave_theory`, `ma_golden_cross`, `volume_breakout`, `shrink_pullback`, and `dragon_head`.

### Build An External Agent Tool

Wrap these operations as tools:

- `health_check()`
- `analyze_stock(code, report_type, force_refresh)`
- `batch_analyze(codes, report_type, force_refresh)`
- `get_task_status(task_id)`
- `agent_chat(message, skills, session_id, context)`
- `get_history(stock_code, page, limit)`

Keep timeouts long enough for analysis. Prefer async analysis for external agents because synchronous calls can take minutes.

## Stock Code Format

- A shares: `600519`, `000001`, `300750`
- Beijing Stock Exchange: six-digit `8`, `4`, or `92` prefixes
- Hong Kong: `hk00700`, `hk09988`
- US stocks: `AAPL`, `TSLA`, `BRK.B`
- US indices: `SPX`, `DJI`, `IXIC`, `NASDAQ`, `VIX`

## Reference

Read `references/api.md` for endpoint details, streaming events, portfolio/backtest APIs, and copy-ready curl examples.
