# Storm WebApp

**Storm (Self-driven Topic Outline and Research Model)** is a library that automates the process of knowledge generation for a given topic. It performs iterative research, outlines generation, and finally crafts an article with cited sources. This project, **Storm WebApp**, provides a user-friendly web interface built with FastAPI (backend) and React (frontend) to:

*   Initiate and manage STORM research runs.
*   Review generated outlines, articles, and cited sources.
*   Provide user authentication and run history.

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
-   View history of past runs (topic, status, timestamp).
-   View details of completed runs:
    -   Generated outline (`.txt`).
    -   Generated article (`.txt`, displayed as Markdown).
    -   Sources used (`url_to_info.json`).
-   Delete past runs (removes database entry and output files).

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
    -   **Action:** Create a `.env` file in your project root (e.g., `/Users/koen/Development/storm_webapp/storm_webapp/.env`) and add your keys:
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

## Development Notes

-   The database (`sql_app.db`) is automatically created/updated on backend startup using SQLAlchemy\'s `create_all`. For production, consider using Alembic for migrations.
-   CORS is configured in the backend to allow requests from `http://localhost:3000`.
-   See [TODO.md](TODO.md) for the current list of pending tasks and potential improvements. 