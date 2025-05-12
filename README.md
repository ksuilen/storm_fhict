# Storm Webapp

This project contains a web application with a Python backend and a React frontend.

## Setup and Running

### Backend (Python/FastAPI)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Activate the virtual environment:
    ```bash
    source venv/bin/activate
    ```
    *(If the venv doesn't exist, create it first: `python -m venv venv`)*
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Start the development server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API will be available at http://127.0.0.1:8000.

### Frontend (React)

1.  Navigate to the frontend directory:
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
    The frontend will be available at http://localhost:3000 (or another port if 3000 is busy).

## To-Do

See [TODO.md](TODO.md) for the current list of tasks and ideas. 