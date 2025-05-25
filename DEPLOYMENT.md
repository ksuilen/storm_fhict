# Deployment Instructies voor Portainer

## Repository Deployment

### Stap 1: stack.env bestand aanmaken
Voor repository deployment verwacht Portainer een `stack.env` file in de Git repository:

1. Kopieer `stack.env.template` naar `stack.env`
2. Vul je eigen waarden in voor:
   - `SECRET_KEY` - Een sterke geheime sleutel voor JWT tokens
   - `OPENAI_API_KEY` - Je OpenAI API key
   - `TAVILY_API_KEY` - Je Tavily API key voor search functionaliteit

**Let op:** `stack.env` staat in `.gitignore` voor security. Voor deployment moet je het lokaal aanmaken.

### Stap 2: Portainer Instellingen

**Repository reference:** `refs/heads/main`
**Compose path:** `docker-compose.prod.yml` (aanbevolen) of `docker-compose.yml`

### Optie 1: Build van Source (docker-compose.yml)
Gebruikt build context, kan lang duren en heeft internet toegang nodig.

### Optie 2: Pre-built Images (docker-compose.prod.yml)  
Gebruikt pre-built images van icop-docker.jelph.nl/koen/, sneller deployment.

## Troubleshooting

### "Unable to deploy stack" errors:
1. **Missing environment variables** - Zorg dat alle vereiste vars zijn ingesteld
2. **Build failures** - Gebruik docker-compose.prod.yml voor pre-built images
3. **Registry access** - Zorg dat Portainer toegang heeft tot je registry
4. **Network issues** - Check of Portainer internet toegang heeft voor builds

### Log Commands
```bash
# Check container logs
docker logs storm-webapp_backend_1
docker logs storm-webapp_frontend_1

# Check if environment variables are set
docker exec storm-webapp_backend_1 env | grep -E "(SECRET_KEY|OPENAI|TAVILY)"
``` 