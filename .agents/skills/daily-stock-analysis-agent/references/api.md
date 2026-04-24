# DSA HTTP API Reference

Use `DSA_BASE_URL` without a trailing slash, for example `http://127.0.0.1:8000`.

## Core Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Health check |
| `/docs` | GET | Swagger UI |
| `/api/v1/analysis/analyze` | POST | Trigger single or batch analysis |
| `/api/v1/analysis/status/{task_id}` | GET | Get one async task status |
| `/api/v1/analysis/tasks` | GET | List recent/current tasks |
| `/api/v1/analysis/tasks/stream` | GET SSE | Stream task lifecycle and progress |
| `/api/v1/history` | GET | List analysis history |
| `/api/v1/history/{query_id}` | GET | Fetch one historical report |
| `/api/v1/agent/skills` | GET | List Agent strategy skills |
| `/api/v1/agent/models` | GET | List configured Agent model deployments |
| `/api/v1/agent/chat` | POST | Non-streaming strategy chat |
| `/api/v1/agent/chat/stream` | POST SSE | Streaming strategy chat and tool progress |
| `/api/v1/agent/research` | POST | Deep research query |
| `/api/v1/backtest/run` | POST | Run backtest over historical reports |
| `/api/v1/backtest/results` | GET | Paginated backtest results |
| `/api/v1/backtest/performance` | GET | Overall backtest metrics |
| `/api/v1/backtest/performance/{code}` | GET | Per-stock backtest metrics |
| `/api/v1/stocks/extract-from-image` | POST multipart | Extract stock codes from image |
| `/api/v1/stocks/parse-import` | POST | Parse CSV/Excel/pasted stock lists |
| `/api/v1/portfolio/snapshot` | GET | Portfolio snapshot |
| `/api/v1/portfolio/risk` | GET | Portfolio risk summary |

## Analysis Requests

Single stock, synchronous:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/analysis/analyze" \
  -H 'Content-Type: application/json' \
  -d '{
    "stock_code": "600519",
    "report_type": "detailed",
    "force_refresh": true,
    "async_mode": false
  }'
```

Batch, asynchronous:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/analysis/analyze" \
  -H 'Content-Type: application/json' \
  -d '{
    "stock_codes": ["600519", "300750", "hk00700", "AAPL"],
    "report_type": "detailed",
    "force_refresh": true,
    "async_mode": true
  }'
```

Notes:

- `async_mode=false` supports one stock only.
- `stock_codes` batch requests require `async_mode=true`.
- Empty codes are filtered; an all-empty request returns `400`.
- The API rejects duplicate running stock tasks with `409 duplicate_task`.
- Batch size is capped by the service, currently 50.

Poll status:

```bash
curl "$DSA_BASE_URL/api/v1/analysis/status/<task_id>"
```

Stream task progress:

```bash
curl -N "$DSA_BASE_URL/api/v1/analysis/tasks/stream"
```

Progress events include `connected`, `task_created`, `task_started`, `task_progress`, `task_completed`, `task_failed`, and `heartbeat`.

## Agent Chat

List skills:

```bash
curl "$DSA_BASE_URL/api/v1/agent/skills"
```

Chat:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/agent/chat" \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "用均线金叉策略分析 AAPL",
    "skills": ["ma_golden_cross"],
    "session_id": "optional-session-id",
    "context": {}
  }'
```

Streaming chat:

```bash
curl -N -X POST "$DSA_BASE_URL/api/v1/agent/chat/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"分析 600519 的趋势和新闻风险","skills":["bull_trend"]}'
```

SSE payloads use JSON lines with `type`, such as `thinking`, `tool_start`, `tool_done`, `generating`, `done`, and `error`.

Deep research:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/agent/research" \
  -H 'Content-Type: application/json' \
  -d '{"question":"近期有哪些影响英伟达估值的关键风险？","stock_code":"NVDA"}'
```

## History And Backtest

History:

```bash
curl "$DSA_BASE_URL/api/v1/history?stock_code=600519&page=1&limit=20"
curl "$DSA_BASE_URL/api/v1/history/<query_id>"
```

Backtest:

```bash
curl -X POST "$DSA_BASE_URL/api/v1/backtest/run" \
  -H 'Content-Type: application/json' \
  -d '{"code":"600519","force":false}'

curl "$DSA_BASE_URL/api/v1/backtest/performance"
curl "$DSA_BASE_URL/api/v1/backtest/performance/600519"
curl "$DSA_BASE_URL/api/v1/backtest/results?page=1&limit=20"
```

## Portfolio

```bash
curl "$DSA_BASE_URL/api/v1/portfolio/snapshot?cost_method=fifo&include_positions=false"
curl "$DSA_BASE_URL/api/v1/portfolio/risk?cost_method=fifo"
```

Use portfolio APIs only for portfolio-aware responses. Avoid implying that generated output is investment advice.

## Error Handling

| HTTP status | Meaning | Agent response |
| --- | --- | --- |
| 400 | Bad input or Agent disabled | Ask for corrected code/config; mention `AGENT_MODE=true` if needed |
| 401/403 | Auth required or invalid session | Ask user to login or provide cookie-capable integration |
| 409 | Duplicate running analysis | Report existing task conflict and suggest polling tasks |
| 500 | DSA/data/LLM failure | Ask user to inspect DSA logs and configuration |

## External Agent/MCP-Style Wrapper Shape

DSA has no native MCP server in this repo. Implement MCP-style integrations as HTTP wrappers over the REST API. Recommended tools:

```text
health_check() -> health payload
analyze_stock(code, report_type="detailed", force_refresh=true) -> report
batch_analyze(codes, report_type="detailed", force_refresh=true) -> task ids
get_task_status(task_id) -> task state/result
agent_chat(message, skills=[], session_id=null, context={}) -> content/session_id
get_history(stock_code=null, page=1, limit=20) -> history list
```
