# Storm WebApp

**Storm (Self-driven Topic Outline and Research Model)** is a library that automates the process of knowledge generation for a given topic. It performs iterative research, outlines generation, and finally crafts an article with cited sources. This project, **Storm WebApp**, provides a user-friendly web interface built with FastAPI (backend) and React (frontend) to:

*   Initiate and manage STORM research runs.
*   Review generated outlines, articles, and cited sources.
*   Provide user authentication and run history.
*   Real-time progress tracking with WebSocket support.
*   Research questions display and progress history.

This application aims to make the power of STORM accessible through an intuitive graphical interface, allowing users to easily explore topics and generate comprehensive reports.

## Project Structure

-   `backend/`: Contains the FastAPI application.
    -   `app/`: Core application code (main routes, schemas, CRUD operations, security, configuration, database models).
    -   `storm_output/`: Default directory where STORM run outputs are stored (organized by user ID and run ID). This directory should be in your `.gitignore`.
    -   `venv/`: Python virtual environment (should be in `.gitignore`).
    -   `requirements.txt`: Python dependencies.
-   `frontend/`: Contains the React application (created with Create React App).
    -   `app/`: Core application code.
        -   `src/`: Source files (components, pages, services, context).
        -   `public/`: Static assets.
        -   `package.json`: Node.js dependencies and scripts.
-   `README.md`: This file.
-   `TODO.md`: List of pending tasks and future ideas.
-   `.gitignore`: Specifies intentionally untracked files that Git should ignore.

## Features

-   User registration and JWT-based authentication.
-   Initiate new STORM runs based on a topic.
*   Real-time progress tracking via WebSocket connections.
-   View history of past runs (topic, status, timestamp).
-   View details of completed runs:
    -   Generated outline (`.txt`).
    -   Generated article (`.txt`, displayed as Markdown).
    -   Sources used (`url_to_info.json`).
    -   Research questions and progress history.
-   Delete past runs (removes database entry and output files).
-   Admin panel for system configuration and model settings.
-   Support for multiple LLM providers via Portkey gateway.

## Model Configuration and Performance

### Recommended Model Setup

The application works best with the following configuration:

**✅ Recommended Models:**
- **Small Model**: `gpt-4o-mini` or `gpt-3.5-turbo` - Fast and efficient for research questions and conversation simulation
- **Large Model**: `gpt-4o` or `mistral-medium` - Proven stable performance for outline generation, article writing, and polishing

**⚠️ Known Issues:**
- **Mistral Large Models**: `mistral-large-2411` has known performance issues and may cause runs to hang during article generation phase. Use `gpt-4o` instead for large model tasks.
- **Reasoning Models**: OpenAI's o1-preview and o1-mini models are not yet fully supported and may cause issues. Avoid using reasoning models.

### Model Configuration via Admin Panel

You can configure models through the admin panel (`/admin/system-settings`):

1. **Small Model Name**: Used for research questions and conversation simulation
2. **Large Model Name**: Used for outline generation, article writing, and polishing
3. **API Configuration**: Set your OpenAI API key and optionally Portkey gateway settings

### Portkey Gateway Support

The application supports using Portkey as an API gateway for accessing multiple LLM providers:

- Set `OPENAI_API_BASE` to your Portkey endpoint (e.g., `https://api.portkey.ai/v1`)
- Configure your Portkey API key as `OPENAI_API_KEY`
- The application automatically handles parameter conflicts between different providers
- Fallback mechanisms ensure compatibility across providers

### Performance Notes

- **Typical Run Time**: 2-3 minutes for most topics
- **Token Limits**: Configured per component (500-4000 tokens depending on task complexity)
- **Timeout Handling**: Runs that hang for extended periods should be manually stopped and restarted
- **Progress Tracking**: Real-time updates show research questions, outline generation, and article writing progress

## Setup and Running

### Prerequisites

-   Python 3.8+ and `pip`.
-   Node.js and `npm`.
-   For Docker-based setup: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose CLI).

### Configuration Notes (General)

-   **Backend (`backend/app/core/config.py`):**
    -   Manages all backend settings, including API keys, model names, and crucially, paths for the database and STORM output.
    -   It uses an `APP_ENV` environment variable (`local` or `docker`) to differentiate between local development and Docker deployment, adjusting `DATABASE_URL` and `STORM_OUTPUT_DIR` paths accordingly.
    -   API keys (OpenAI, Tavily, etc.) are read from environment variables.
-   **Frontend (`frontend/app/`):**
    -   For local development (running `npm start`), create a `.env` file in `frontend/app/` and set `REACT_APP_API_URL=http://localhost:8000` to point to your local backend.
    -   When built with Docker, `REACT_APP_API_URL` is set to `/api` (via build arguments in `docker-compose.yml`) to use the Nginx proxy.

### Backend (Python/FastAPI) - Local Non-Docker

1.  Set `APP_ENV=local` (or ensure it's not set, as "local" is the default) if you plan to run locally. This can be done by setting an environment variable in your shell or by creating a `.env` file in the `backend/` directory (e.g., `echo "APP_ENV=local" > backend/.env`).
2.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
3.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\\Scripts\\activate`
    ```
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
5.  Start the development server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API will be available at http://127.0.0.1:8000. The SQLite database (`./backend/sql_app.db`) will be created automatically on first run.

### Frontend (React) - Local Non-Docker

1.  Ensure your local backend is running (see above).
2.  Navigate to the frontend app directory:
    ```bash
    cd frontend/app
    ```
3.  **Create `.env` file (if it doesn't exist):**
    Create a file named `.env` in the `frontend/app/` directory and add the following line:
    ```
    REACT_APP_API_URL=http://localhost:8000
    ```
    This tells the frontend to send API requests directly to your local backend.
4.  Install dependencies (if not already done):
    ```bash
    npm install
    ```
    **Opmerking:** Als je recent de PDF download functionaliteit hebt toegevoegd, zorg ervoor dat `html2pdf.js` is geïnstalleerd door opnieuw `npm install` uit te voeren.
5.  Start the development server:
    ```bash
    npm start
    ```
    The frontend will open automatically in your browser, likely at http://localhost:3000.

### Running with Docker (Recommended for Local Development and Deployment)

This project is configured to run with Docker Compose, which simplifies setup and ensures a consistent environment.

**Prerequisites:**

-   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose CLI) installed and running.

**Configuration via Docker Compose (`docker-compose.yml`):**

-   **`APP_ENV` for Backend:** The `docker-compose.yml` automatically sets `APP_ENV=docker` for the backend service. This ensures the backend uses container-specific paths for the database (`/data/database/storm_app.db`) and output (`/data/storm_output/`).
-   **API Keys & Secrets:**
    -   Sensitive information like `SECRET_KEY`, `TAVILY_API_KEY`, `OPENAI_API_KEY`, etc., are passed to the backend container as environment variables.
    -   The `docker-compose.yml` uses the `${VAR_NAME:-}` syntax (e.g., `OPENAI_API_KEY=${OPENAI_API_KEY:-}`). This means Docker Compose will:
        1.  Look for these variables in a `.env` file located in the **project root directory** (same directory as `docker-compose.yml`). This is the recommended way to manage your keys for Dockerized development.
        2.  If not found in the root `.env` file, it looks for them in your host machine's environment variables.
        3.  If still not found, it defaults to an empty string (suppressing "variable not set" warnings from Docker Compose).
    -   **Action:** Create a `.env` file in your project root (same directory as `docker-compose.yml`) and add your keys:
        ```env
        SECRET_KEY=your_strong_secret_key_here
        OPENAI_API_KEY=sk-your_openai_api_key
        TAVILY_API_KEY=tvly-your_tavily_api_key
        # Add other keys as needed (YDC_API_KEY, etc.)
        ```
-   **Frontend Port:** Accessible on a port you can specify via the `FRONTEND_PORT` environment variable (defaults to 80).
-   **Data Persistence:** Database data and Storm outputs are persisted in Docker named volumes (`storm_db_data`, `storm_output_data`).

**Steps to Run:**

1.  **Build the Docker images:**
    Open a terminal in the root directory of the project (where `docker-compose.yml` is located) and run:
    ```bash
    docker-compose build
    ```

2.  **Start the application:**
    To start the services in the foreground (you'll see logs in your terminal):
    ```bash
    docker-compose up
    ```
    To start the services in detached mode (runs in the background):
    ```bash
    docker-compose up -d
    ```
    To specify a custom port for the frontend (e.g., 3001), set the `FRONTEND_PORT` environment variable:
    ```bash
    FRONTEND_PORT=3001 docker-compose up
    ```
    If `FRONTEND_PORT` is not set, it defaults to port 80.

3.  **Access the application:**
    Open your web browser and navigate to `http://localhost:PORT`, where `PORT` is the one you specified with `FRONTEND_PORT` (or 80 if not specified).
    For example, if you used `FRONTEND_PORT=3001`, go to `http://localhost:3001`.

4.  **View logs (if running in detached mode):**
    ```bash
    docker-compose logs -f backend
    docker-compose logs -f frontend
    ```
    (Use `Ctrl+C` to stop following logs).

5.  **Stop the application:**
    If running in the foreground, press `Ctrl+C` in the terminal where `docker-compose up` is running.
    If running in detached mode, or to ensure everything is stopped and removed (containers, default network):
    ```bash
    docker-compose down
    ```
    To also remove the named volumes (this will delete your database and storm output!):
    ```bash
    docker-compose down -v
    ```

### Bouwen van Multi-Platform Images voor Deployment

Als je de applicatie wilt deployen op een server (zoals een Portainer-omgeving) die een andere CPU-architectuur heeft dan je ontwikkelmachine (bijvoorbeeld je bouwt op een Mac met Apple Silicon/ARM64, maar de server is Linux/AMD64), dan moet je multi-platform images bouwen. Doe je dit niet, dan kun je fouten krijgen zoals `no matching manifest for linux/amd64 in the manifest list entries`.

Docker `buildx` wordt gebruikt om deze multi-platform images te creëren en direct naar je Docker registry te pushen.

1.  **Log in bij je Docker Registry** (vervang `your-registry.com` en `your-username`):
    ```bash
    docker login your-registry.com -u your-username
    ```

2.  **Bouw en push de backend image** (vervang `your-registry.com/your-repo/your-app-backend:latest`):
    ```bash
    docker buildx build --platform linux/amd64,linux/arm64 -t your-registry.com/your-repo/storm-backend:latest --push ./backend
    ```
    *Opmerking*: Als de `pip install` stap voor het `linux/amd64` platform lang duurt en faalt met een `ReadTimeoutError`, verhoog dan de timeout in `backend/Dockerfile` (bijv. `RUN pip install --timeout 600 --no-cache-dir -r requirements.txt`).

3.  **Bouw en push de frontend image** (vervang `your-registry.com/your-repo/storm-frontend:latest`):
    ```bash
    docker buildx build --platform linux/amd64,linux/arm64 -t your-registry.com/your-repo/storm-frontend:latest --push ./frontend/app
    ```

Nu zijn je images klaar in de registry voor de deployment.

## Deployment naar Portainer (of andere Docker-omgeving)

Nadat je de multi-platform images naar je Docker registry hebt gepusht, kun je de applicatie deployen.

1.  **Configureer je Registry in Portainer:**
    *   Ga in Portainer naar "Registries" en voeg je private Docker registry toe met de benodigde credentials.

2.  **Maak een nieuwe Stack in Portainer:**
    *   Gebruik de volgende aangepaste `docker-compose.yml`. Deze versie gebruikt de `image:` directive om te verwijzen naar de images in je registry, in plaats van ze lokaal te bouwen.

    ```yaml
    services:
      backend:
        image: your-registry.com/your-repo/storm-backend:latest # VERVANG DIT
        environment:
          - APP_ENV=docker
          # BELANGRIJK: Stel TAVILY_API_KEY, OPENAI_API_KEY, SECRET_KEY, etc.
          # in via de Portainer UI (Environment variables sectie van de stack).
          # Of gebruik een stack.env file (zie DEPLOYMENT.md)
        volumes:
          - storm_db_data:/data/database # Zorgt voor persistentie van de database
          - storm_output_data:/data/storm_output # Zorgt voor persistentie van outputs
        restart: unless-stopped

      frontend:
        image: your-registry.com/your-repo/storm-frontend:latest # VERVANG DIT
        ports:
          - "80:80" # HOST_PORT:CONTAINER_PORT (bijv. "3000:80" om op poort 3000 te draaien)
        depends_on:
          - backend
        restart: unless-stopped

    volumes:
      storm_db_data:
      storm_output_data:
    ```

3.  **Stel Environment Variabelen in Portainer in:**
    *   **Cruciaal:** In de Portainer UI, bij het aanmaken of bewerken van de stack, ga naar de sectie "Environment variables". Voeg hier alle benodigde variabelen toe voor de `backend` service, zoals `SECRET_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`, en eventuele andere configuraties die je backend nodig heeft.
    *   Voor de `frontend` service kun je hier eventueel de host-poort specificeren als je die niet hardcodeert in de `ports` sectie van de YAML hierboven (bijv. door een `FRONTEND_HOST_PORT` variabele te gebruiken en in de YAML `- "${FRONTEND_HOST_PORT:-80}:80"` te zetten).

4.  **Deploy de Stack.**

## Development Notes

-   De database (`storm_app.db`) wordt automatisch aangemaakt/bijgewerkt bij de backend startup met SQLAlchemy's `create_all`. Voor productie, overweeg Alembic voor migraties.
-   CORS is configured in the backend to allow requests from `http://localhost:3000`.
-   WebSocket connections provide real-time progress updates during STORM runs.
-   The application uses STORM V2 (repository version) with enhanced model compatibility and fallback mechanisms.
-   JWT tokens expire after 8 hours (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`).

## Troubleshooting

### Common Issues

**Run Hangs or Takes Too Long:**
- Check if you're using a supported model (avoid `mistral-large-2411` and reasoning models)
- Verify your API keys are correctly configured
- Monitor logs for parameter conflicts or API errors
- Typical runs should complete in 2-3 minutes

**WebSocket Connection Issues:**
- Ensure frontend and backend are properly connected
- Check browser console for WebSocket errors
- Verify Nginx proxy configuration if using Docker

**Database Issues:**
- Database migrations are handled automatically
- For persistent data, ensure Docker volumes are properly configured
- Check file permissions if running locally

**Model Configuration:**
- Use the admin panel to verify model settings
- Test with recommended models first (`gpt-4o` for large model tasks)
- Check API key validity and rate limits

### Logs and Debugging

- **Docker logs**: `docker-compose logs -f backend` or `docker-compose logs -f frontend`
- **Local development**: Check terminal output for FastAPI and React dev servers
- **WebSocket debugging**: Monitor browser developer tools Network tab
- **Database inspection**: SQLite database is located at `/data/database/storm_app.db` (Docker) or `backend/storm_local_dev.db` (local)

## Current Status

✅ **Working Features:**
- Complete STORM research pipeline
- Real-time progress tracking
- Multi-provider LLM support via Portkey
- User authentication and run history
- Admin configuration panel
- Docker deployment

⚠️ **Known Limitations:**
- Reasoning models (o1-preview, o1-mini) not supported
- Mistral large models may have performance issues
- No automatic timeout handling for hanging runs
- Limited error recovery for failed API calls

See [TODO.md](TODO.md) for the current list of pending tasks and potential improvements.