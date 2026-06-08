# AI Expense Classifier

Single-user application that ingests PDF bills or expense images, extracts
text via OCR or direct PDF parsing, classifies each expense through a local
LLM (Ollama), and surfaces results through a dashboard with charts, filters,
and Excel export.

## Stack

- **API** — TypeScript · Fastify · Prisma · BullMQ · JWT
- **Worker** — Python 3.11 · EasyOCR · pdfplumber · Ollama (`qwen2.5:7b-instruct-q3_K_M`)
- **Frontend** — React 18 · Vite · Material UI (MUI) · TanStack Query/Table · Recharts
- **Infra** — PostgreSQL · Redis · Docker Compose

## Architecture

### System overview

```mermaid
graph LR
    FE["Frontend\n(React + Vite)"]
    API["API\n(Fastify + Prisma)"]
    DB[(PostgreSQL)]
    REDIS[(Redis)]
    W["Worker\n(Python · OCR · Ollama)"]

    FE -->|"REST / WebSocket"| API
    API -->|"Prisma ORM"| DB
    API -->|"BullMQ enqueue"| REDIS
    W -->|"BullMQ consume"| REDIS
    W -->|"POST /internal/result"| API
```

The Worker pulls jobs from Redis, runs OCR + LLM classification, then calls
back the API's internal route to persist the extracted expenses in Postgres.

### Request flow — `POST /api/documents`

This route illustrates the layered architecture used across the entire API:
**Controller → Service → Repository**, with Services orchestrating cross-cutting
concerns (storage, queue) and Repositories owning all database access via Prisma.

```mermaid
flowchart TD
    Client(["Client"])

    subgraph API
        MW["authMiddleware\nverify JWT · attach userId"]
        C["DocumentController\n<i>parse multipart body</i>"]
        S["DocumentService\n<i>business logic</i>"]
        VALID{{"type & size\nvalidation"}}
        SS["StorageService\nsave file to disk"]
        R["DocumentRepository\ncreate record"]
        Q["JobQueueService\nenqueue processing job"]
    end

    DB[("PostgreSQL\n(via Prisma)")]
    REDIS[("Redis\n(BullMQ)")]

    Client -->|"POST /api/documents\nmultipart/form-data"| MW
    MW -->|"req.userId"| C
    C -->|"buffer · originalName · mimeType"| S
    S --> VALID
    VALID -->|"invalid"| ERR(["400 / 413 Error"])
    VALID -->|"valid"| SS
    SS -->|"filePath"| R
    R -->|"INSERT document"| DB
    DB -->|"Document"| R
    R -->|"Document"| S
    S -->|"documentId · filePath · fileType"| Q
    Q -->|"LPUSH job"| REDIS
    S -->|"Document"| C
    C -->|"201 Document"| Client
```

```mermaid
sequenceDiagram
    actor Client
    participant MW as authMiddleware
    participant C as DocumentController
    participant S as DocumentService
    participant SS as StorageService
    participant R as DocumentRepository
    participant DB as PostgreSQL
    participant Q as JobQueueService
    participant Redis

    Client->>MW: POST /api/documents (multipart)
    MW-->>Client: 401 Unauthorized (invalid JWT)
    MW->>C: req.userId

    C->>S: upload(userId, { buffer, originalName, mimeType })

    alt unsupported type or file too large
        S-->>C: throws AppError
        C-->>Client: 400 / 413 Error
    end

    S->>SS: saveUploadedFile(buffer, originalName)
    SS-->>S: filePath

    S->>R: create({ userId, originalName, filePath, fileType })
    R->>DB: INSERT document
    DB-->>R: Document
    R-->>S: Document

    S->>Q: enqueue({ documentId, filePath, fileType, userId })
    Q->>Redis: LPUSH job

    S-->>C: Document
    C-->>Client: 201 Document
```

## Quick start

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up
```

API: http://localhost:3000 · Frontend: http://localhost:5173 · Prisma Studio: http://localhost:5555

## Tests

```bash
# Unit (no infra)
docker compose -f docker-compose.dev.yml run --rm api npx vitest run
docker compose -f docker-compose.dev.yml run --rm worker pytest worker/tests -m "not integration"

# Integration (real Postgres/Redis/Ollama)
./scripts/run-integration-tests.sh
```
