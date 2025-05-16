# Storm Webapp

This project provides a web interface for initiating and managing knowledge generation runs using the STORM library. It consists of a Python/FastAPI backend and a React frontend.

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

### Configuration

-   **Backend:** The backend uses settings from `backend/app/core/config.py`. While environment variables (`.env` file in `backend/`) are supported for sensitive data like `SECRET_KEY`, defaults are provided for basic setup. The `STORM_OUTPUT_DIR` setting defines where run results are stored (defaults to `backend/storm_output`).
-   **Frontend:** The API base URL is currently hardcoded in `frontend/app/src/App.js` (`API_BASE_URL = \'http://localhost:8000\'`). Adjust this if your backend runs elsewhere.

### Backend (Python/FastAPI)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\\Scripts\\activate`
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Start the development server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API will be available at http://127.0.0.1:8000. The SQLite database (`./backend/sql_app.db`) will be created automatically on first run.

### Frontend (React)

1.  Navigate to the frontend app directory:
    ```bash
    cd frontend/app
    ```
2.  Install dependencies (if not already done):
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm start
    ```
    The frontend will open automatically in your browser, likely at http://localhost:3000.

## Development Notes

-   The database (`sql_app.db`) is automatically created/updated on backend startup using SQLAlchemy\'s `create_all`. For production, consider using Alembic for migrations.
-   CORS is configured in the backend to allow requests from `http://localhost:3000`.
-   See [TODO.md](TODO.md) for the current list of pending tasks and potential improvements. 