# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Node.js/Express)
- `npm start` - Start development server with verbose logging
- `npm run start-prod` - Start production server
- `npm run worker` - Start Temporal worker for development
- `npm run worker-prod` - Start Temporal worker for production
- `npm run temporal` - Start Temporal server (dev UI on port 8080)

### Frontend (React)
- `npm start` - Start development server on port 3001
- `npm run build` - Build for production
- `npm test` - Run tests

### Docker Development
- `docker-compose -f docker-compose-dev.yml up` - Start all services (PostgreSQL, Redis, MinIO, Elasticsearch, Temporal)
- Services exposed:
  - PostgreSQL: 5432
  - Redis: 6379
  - MinIO: 9000
  - Elasticsearch: 9200
  - Temporal: 7233, UI: 8080

## High-Level Architecture

### Core Concepts

**Prompt Store** is a CMS for AI prompts that operates as a "Semantic Functions as a Service" platform. The system separates prompt management from application code to enable better governance, measurement, and improvement of AI applications.

### Key Components

1. **Semantic Functions** (`backend/src/core/semanticfunctions/`)
   - Controller that ties together model, prompt, semantic index, and guardrails
   - Supports multiple implementations with A/B testing via experiments
   - Handles validation, execution, and response processing
   - Located in `SemanticFunction.ts` and `SemanticFunctionImplementation.ts`

2. **Compositions** (`backend/src/core/compositions/`)
   - Visual workflow system for chaining multiple AI operations
   - Node-based architecture supporting various node types:
     - `agentNode`, `functionNode`, `toolNode` - Execute AI operations
     - `loopNode`, `mapperNode`, `joinerNode` - Control flow
     - `forkNode` - Conditional branching
     - `vectorStoreNode`, `graphStoreNode` - Data storage
     - `extractorNode`, `loaderNode` - Data processing
   - Located in `Composition.ts` with types in `Composition_types.ts`

3. **Plugin Architecture** (`backend/src/plugins/`)
   - Modular system for integrating various AI services and data sources
   - LLM providers: OpenAI, Anthropic, Bedrock, etc.
   - Vector stores: Chroma, Neo4j, Elasticsearch
   - Extractors: Unstructured, CSV, JSON, Neo4j, Crawler
   - Guardrails: PII detection, query rewriting, emoji removal

4. **Frontend** (`frontend/src/`)
   - React application with Redux Toolkit for state management
   - Feature-based organization under `features/`
   - Key features:
     - `composer/` - Visual workflow editor for compositions
     - `promptSets/` - Prompt template management
     - `functions/` - Semantic function definitions
     - `apps/` - AI application builder
     - `traces/` - Observability and monitoring

### Data Flow

1. **Prompt Templates** → **Semantic Functions** → **Compositions** → **Applications**
2. **Data Sources** → **Extractors** → **Vector/Graph Stores** → **Semantic Search**
3. **Requests** → **Guardrails** → **Model Execution** → **Tracing** → **Response**

### Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript, Redux Toolkit, Ant Design
- **Database**: PostgreSQL for metadata, Redis for caching
- **Storage**: MinIO for object storage
- **Workflow**: Temporal for distributed workflows
- **Search**: Elasticsearch for full-text search
- **Vector**: Chroma/Neo4j for embeddings
- **Observability**: Winston logging, Grafana/Loki integration

### File Structure Guidelines

- `backend/src/core/` - Core business logic (compositions, semantic functions)
- `backend/src/plugins/` - Extensible plugin system
- `backend/src/services/` - Service layer for business operations
- `backend/src/routes/` - API endpoint definitions
- `frontend/src/features/` - Feature-based React components
- `frontend/src/components/` - Reusable UI components

### Development Notes

- Backend uses ES modules with `ts-node` loader
- Frontend proxies API requests to backend (localhost:5001)
- TypeScript strict mode enabled in both frontend and backend
- Plugin system allows for easy extension of capabilities
- Temporal workflows handle long-running operations
- Comprehensive tracing system for observability

### Testing

- Backend: No test script configured (shows "Error: no test specified")
- Frontend: Uses react-scripts test runner
- Integration tests should use Docker Compose setup

### Key Patterns

- **Plugin Architecture**: Consistent interface for all external integrations
- **Node-based Workflows**: Compositions use a directed graph structure
- **Semantic Functions**: Abstraction layer over various AI models
- **Tracing**: Comprehensive logging for debugging and monitoring
- **Multi-tenancy**: Workspace-based isolation