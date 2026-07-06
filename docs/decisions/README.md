# Architecture Decision Records

Numbered ADRs for EduInsight. Read relevant decisions before changing schema, APIs, or agent behavior.

| ADR | Title | Status |
|:---:|:------|:------:|
| [0001](0001-fastapi-over-flask.md) | FastAPI over Flask/Django | accepted |
| [0002](0002-langgraph-over-langchain.md) | LangGraph over standard LangChain | accepted |
| [0003](0003-openai-model-tiering.md) | OpenAI GPT-5 series with model tiering | accepted |
| [0004](0004-pgvector-over-chromadb.md) | pgvector on PostgreSQL over ChromaDB | accepted |
| [0005](0005-single-postgres-multi-schema.md) | Single PostgreSQL, multi-schema MVP | accepted |
| [0006](0006-ml-agent-boundary.md) | ML prediction vs LLM explanation boundary | accepted |
| [0007](0007-sqlalchemy-alembic.md) | SQLAlchemy ORM + Alembic migrations | accepted |
| [0008](0008-academic-tree.md) | Academic Tree 3-tier hierarchy | accepted |
| [0009](0009-homeroom-assignment-scope.md) | Explicit homeroom assignment scope | accepted |
| [0010](0010-langsmith-tracing.md) | LangSmith tracing for agent observability | accepted |
| [0011](0011-agent-concurrency-limiter.md) | In-process semaphore for agent concurrency limiting | accepted |
| [0012](0012-aws-ec2-production-hosting.md) | AWS EC2 (Singapore) thay Render làm production hosting | accepted |

Human decisions not yet formalized as ADRs may appear in [docs/worklog.md](../worklog.md). New decisions: add the next numbered file here.
