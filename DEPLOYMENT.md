# Deployment Guide

This guide covers deploying Storm WebApp using Docker and Docker Compose, both for local development and production environments (e.g., Portainer, cloud platforms).

## Quick Start with Docker Compose

### Prerequisites
- Docker and Docker Compose installed
- Access to a Docker registry (for production deployment with pre-built images)

### Local Development

1. **Create environment file:**
   ```bash
   cp stack.env.template .env
   ```

2. **Configure environment variables in `.env`:**
   ```env
   SECRET_KEY=your_strong_secret_key_here
   OPENAI_API_KEY=sk-your_openai_api_key
   TAVILY_API_KEY=tvly-your_tavily_api_key
   # Add other API keys as needed
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Frontend: http://localhost (or port specified in FRONTEND_PORT)
   - Backend API: http://localhost:8000

### Production Deployment

#### Option 1: Build from Source
Use `docker-compose.yml` to build images from source:
```bash
docker-compose build
docker-compose up -d
```

#### Option 2: Pre-built Images (Recommended)
Use `docker-compose.prod.yml` with pre-built images from your registry:

1. Build and push multi-platform images:
   ```bash
   # Backend
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t your-registry.com/your-repo/storm-backend:latest \
     --push ./backend

   # Frontend
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t your-registry.com/your-repo/storm-frontend:latest \
     --push ./frontend/app
   ```

2. Update `docker-compose.prod.yml` with your registry URLs

3. Deploy:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Portainer Deployment

### Setup Steps

1. **Add your Docker registry in Portainer** (if using private registry)

2. **Create new Stack in Portainer:**
   - **Repository reference:** `refs/heads/main`
   - **Compose path:** `docker-compose.prod.yml`

3. **Set environment variables in Portainer UI:**
   - `SECRET_KEY` - Strong secret for JWT tokens
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `TAVILY_API_KEY` - Your Tavily search API key
   - `OPENAI_API_BASE` - (Optional) Custom API endpoint (e.g., Portkey gateway)
   - `SMALL_MODEL_NAME` - Small model for research (default: gpt-4o-mini)
   - `LARGE_MODEL_NAME` - Large model for article generation (default: gpt-4o)

4. **Deploy the Stack**

### Using stack.env (Alternative)

Instead of setting variables in Portainer UI, you can use a `stack.env` file:

1. Copy template: `cp stack.env.template stack.env`
2. Fill in your values
3. Commit to private repository or upload via Portainer

**Note:** `stack.env` is in `.gitignore` for security on public repos.

## Database Migrations

Database schema is managed with Alembic and runs automatically on container startup.

### Automatic Migration (Default)
The backend container automatically runs `alembic upgrade head` on startup.

### Manual Migration (if needed)
```bash
# Access backend container
docker exec -it <container-name> sh

# Run migrations
cd /app
alembic current  # Check current revision
alembic upgrade head  # Upgrade to latest
```

### Fresh Database
For a new deployment, migrations create all tables automatically.

## Monitoring & Troubleshooting

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Check Container Status
```bash
docker-compose ps
```

### Verify Environment Variables
```bash
docker exec <backend-container> env | grep -E "(SECRET_KEY|OPENAI|TAVILY)"
```

### Common Issues

**Database Migration Errors:**
- Ensure backend container has write access to `/data/database` volume
- Check logs for specific Alembic errors
- For complex issues, see Database Migrations section in main README

**Model Configuration Issues:**
- Verify API keys are correctly set
- Check model names match your provider's available models
- Use admin panel to verify/update configuration at runtime

**Connection Issues:**
- Ensure frontend can reach backend (proxy configuration)
- Check Docker network configuration
- Verify firewall rules for exposed ports

## Data Persistence

Application data is stored in Docker named volumes:

- `storm_db_data`: SQLite database
- `storm_output_data`: Generated STORM articles and outputs

### Backup Volumes
```bash
# Backup database
docker run --rm -v storm_db_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%F).tar.gz /data

# Backup outputs
docker run --rm -v storm_output_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/output-backup-$(date +%F).tar.gz /data
```

### Restore Volumes
```bash
# Restore database
docker run --rm -v storm_db_data:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/db-backup-YYYY-MM-DD.tar.gz --strip 1"
```

## Security Considerations

1. **Environment Variables:** Never commit `.env` or `stack.env` with real credentials
2. **Registry Access:** Use private registries for production images
3. **Network Security:** Configure firewall rules and reverse proxy (nginx, traefik)
4. **Database:** Regular backups of the `storm_db_data` volume
5. **Updates:** Keep images updated with security patches

## Scaling Considerations

**Current Setup (Single Instance):**
- Suitable for small to medium deployments
- Concurrency controls limit simultaneous STORM runs
- SQLite database (single-file, no external dependencies)

**Future Scaling (Multi-Instance):**
- Switch to PostgreSQL for multi-instance deployments
- Use Redis for distributed concurrency control
- Shared storage for STORM outputs (NFS, S3)
- Load balancer for frontend/backend

## Configuration Reference

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ENV` | Environment mode | `docker` |
| `SECRET_KEY` | JWT signing key | *Required* |
| `OPENAI_API_KEY` | OpenAI API key | *Required* |
| `TAVILY_API_KEY` | Tavily search API key | *Required* |
| `OPENAI_API_BASE` | Custom API endpoint | `https://api.openai.com/v1` |
| `SMALL_MODEL_NAME` | Model for research | `gpt-4o-mini` |
| `LARGE_MODEL_NAME` | Model for generation | `gpt-4o` |
| `STORM_MAX_CONCURRENT_RUNS` | Global concurrent run limit | `2` |
| `STORM_MAX_CONCURRENT_RUNS_PER_VOUCHER` | Per-voucher limit | `1` |
| `FRONTEND_PORT` | Host port for frontend | `80` |

See `backend/app/core/config.py` for full configuration options.