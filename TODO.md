# Project TODO List voor Storm WebApp

## Backend

- [ ] **Asynchrone Storm Taken:**
    - [ ] Implementeer `BackgroundTasks` voor de `/storm/run` endpoint om te voorkomen dat de API lang blokkeert.
    - [ ] Ontwerp een mechanisme voor de gebruiker om de status van een achtergrondtaak op te vragen (bv. via een `/storm/status/{task_id}` endpoint).
    - [ ] Ontwerp een mechanisme om de resultaten van een voltooide achtergrondtaak op te halen (bv. via een `/storm/results/{task_id}` endpoint).
    - [ ] Overweeg een robuustere task queue (Celery, RQ) voor productie als er veel zware taken tegelijk draaien.

- [ ] **Authenticatie & Autorisatie:**
    - [ ] Test de token-gebaseerde authenticatie grondig, vooral i.c.m. de frontend.
    - [ ] Overweeg refresh tokens voor langere sessies.
    - [ ] Implementeer eventueel rollen of permissies als verschillende gebruikersniveaus nodig zijn.

- [ ] **Storm Integratie Verfijning:**
    - [ ] Maak de `StormRunResponse` in `schemas.py` specifieker gebaseerd op de daadwerkelijke output van `runner.summary()` en de gewenste bestanden.
    - [ ] Verbeter foutafhandeling in `storm_runner.py` en het `/storm/run` endpoint. Vang specifiekere exceptions van de `knowledge_storm` library.
    - [ ] Maak meer `STORMWikiRunnerArguments` configureerbaar via `config.py` en/of de API request body (`StormRunRequest`).
    - [ ] Optimaliseer de initialisatie van `STORMWikiRunner` (bv. zorgen dat het echt maar één keer gebeurt en alle configuratie correct laadt bij de start van de app).
    - [ ] Onderzoek de exacte output structuur en bestandsnamen van Storm en pas de code voor het lezen van het artikel (`article_path` in `main.py`) hierop aan voor robuustheid.
    - [ ] **Portkey Integratie:** Onderzoek en implementeer het routeren van LLM calls (OpenAI/Azure) via Portkey.ai in plaats van directe API aanroepen. Dit betreft aanpassingen in `storm_runner.py` bij de initialisatie van `OpenAIModel` of `AzureOpenAIModel`.

- [ ] **Database & Modellen:**
    - [ ] Overweeg het gebruik van Alembic voor database migraties als het schema evolueert.
    - [ ] Breid het `User` model eventueel uit met relaties naar opgeslagen Storm-taken of resultaten.
    - [ ] Sla metadata over Storm-runs (topic, gebruiker, starttijd, status, output_pad) op in de database.

- [ ] **Configuratie & Secrets:**
    - [ ] Zorg dat alle gevoelige keys en configuratie veilig via environment variables (.env) beheerd worden en nooit hardcoded zijn.
    - [ ] Documenteer de vereiste environment variables in de README.

- [ ] **Logging & Monitoring:**
    - [ ] Implementeer gestructureerde logging voor de applicatie.
    - [ ] Overweeg monitoring tools voor productie.

- [ ] **Testen:**
    - [ ] Schrijf unit tests voor de API endpoints en business logica.
    - [ ] Schrijf integratietests.

## Frontend (Nog te beginnen)

- [ ] **Tech Stack Keuze:** Beslis definitief over React, Vue, Svelte, etc. (Gekozen: React)
- [x] **Basis Structuur:** Opzetten van mappen, componenten, routing.
- [x] **Authenticatie Flow:**
    - [x] Login pagina.
    - [ ] Registratie pagina. (Nog niet gemaakt, wel service call)
    - [x] Token opslag en beheer (veilig!).
    - [x] Versturen van token in `Authorization` header bij API calls.
    - [x] Uitlog functionaliteit.
- [ ] **Storm Interface:**
    - [x] Formulier om een Storm-taak (topic, parameters) te starten. (Checkboxes verwijderd)
    - [ ] UI om de status van lopende/voltooide taken te tonen.
    - [x] UI om de resultaten (artikel, samenvatting) van Storm-taken weer te geven.
    - [ ] **Layout Verbetering:** Implementeer ChatGPT-achtige layout met geschiedenis in linkerzijbalk en hoofdcontent rechts. (Bezig)
    - [ ] **Geschiedenis Functionaliteit:**
        - [x] Basis UI voor (mock) geschiedenis in zijbalk.
        - [ ] Backend endpoint om daadwerkelijke run geschiedenis per gebruiker op te slaan en op te halen.
        - [ ] Frontend integratie met backend voor echte geschiedenis.
- [ ] **Gebruikersbeheer UI (optioneel):** Pagina om profiel te beheren.
- [ ] **Styling & UX:** Zorg voor een gebruiksvriendelijke en aantrekkelijke interface. (Basis Bootstrap toegevoegd, kan verfijnd worden)
- [ ] **Admin Functionaliteit (Later):**
    - [ ] Admin rol in backend.
    - [ ] UI voor admin om overall statistieken van Storm runs te zien.

## Deployment & DevOps

- [ ] **Dockerificatie:**
    - [ ] Schrijf `Dockerfile` voor de backend.
    - [ ] Schrijf `Dockerfile` voor de frontend.
    - [ ] Maak een `docker-compose.yml` voor lokale ontwikkeling en eventueel productie.
- [ ] **CI/CD Pipeline:** Opzetten van geautomatiseerde tests en deployments.
- [ ] **Productie Hosting:** Keuze en configuratie van hosting platform.

## Algemeen

- [ ] **README.md:** Uitgebreide documentatie over setup, configuratie, draaien van de app, API endpoints, etc.

## WebSocket Progress Persistence

**Goal:** Preserve STORM run progress details (WebSocket updates, status history, completion summary) so users can see the full progress history even after logout/login or page refresh.

**Current Issue:** 
- WebSocket progress updates are only stored in frontend React state
- When user logs out/in or refreshes page, all progress history is lost
- Only basic run status (pending/running/completed) is preserved in database
- Completed runs show summary but no detailed progress history

**Proposed Solution:**

### Backend Changes:

1. **New Database Table: `storm_progress_updates`**
   ```sql
   - id: Primary Key
   - run_id: Foreign Key to storm_runs table
   - timestamp: DateTime of the update
   - phase: String (research_planning, research_execution, etc.)
   - status: String (info, success, warning, error)
   - message: Text (detailed status message)
   - progress: Integer (0-100 percentage)
   - details: JSON (structured data like sources, perspectives, etc.)
   - created_at: DateTime
   ```

2. **Modify WebSocket Callback Handler:**
   - `WebSocketCallbackHandler` should also save each update to database
   - Add method: `save_progress_update(run_id, phase, status, message, progress, details)`
   - Ensure database writes don't slow down WebSocket broadcasts

3. **New API Endpoints:**
   - `GET /v1/storm/progress/{run_id}`: Retrieve all progress updates for a run
   - `GET /v1/storm/progress/{run_id}/summary`: Get completion summary with final stats
   - Include pagination for runs with many updates

4. **Database Schema Migration:**
   - Alembic migration to create `storm_progress_updates` table
   - Add indexes on `run_id` and `timestamp` for efficient queries

### Frontend Changes:

1. **Modify StormStatusTracker Component:**
   - Add prop `persistProgress: boolean` to enable/disable persistence
   - On component mount for completed runs:
     - Fetch progress history from `GET /v1/storm/progress/{run_id}`
     - Populate `updates` state with historical data
     - Show completion summary with final statistics
   - For running runs: continue with WebSocket + save to state as before

2. **Enhanced Progress Display:**
   - Show "Progress History" section for all runs (not just active ones)
   - Add timestamps to all progress updates
   - Group updates by phase for better readability
   - Add "Show Full History" toggle for runs with many updates

3. **Caching Strategy:**
   - Cache progress data in localStorage with run_id as key
   - Merge cached data with fresh WebSocket updates
   - Clear cache when run completes to force fresh fetch

### Implementation Priority:

**Phase 1: Database Storage**
- [ ] Create `storm_progress_updates` table and migration
- [ ] Modify `WebSocketCallbackHandler` to save updates to DB
- [ ] Add API endpoint to retrieve progress history
- [ ] Test that progress is properly saved during STORM runs

**Phase 2: Frontend Integration**
- [ ] Modify `StormStatusTracker` to fetch historical progress
- [ ] Enhance UI to show complete progress timeline
- [ ] Add loading states for progress history fetching
- [ ] Test persistence across logout/login cycles

**Phase 3: Optimization**
- [ ] Add pagination for runs with many progress updates
- [ ] Implement caching strategy for better performance
- [ ] Add cleanup job for old progress data (optional)
- [ ] Performance testing with multiple concurrent runs

### Benefits:
- Users can see complete progress history for any run
- Better debugging capabilities for failed runs
- Improved user experience with persistent progress tracking
- Foundation for future analytics and run statistics

### Considerations:
- Database storage overhead (estimate ~50-200 updates per run)
- WebSocket performance impact (should be minimal with async DB writes)
- Data retention policy (how long to keep detailed progress?)
- Privacy: ensure users only see their own run progress

## Dynamic Configuration via Admin UI

**Goal:** Allow administrators to view and override application settings (currently from `.env`) through an admin UI. The system should gracefully fall back to `.env` values if no override is set in the UI.

**Backend Changes:**

1.  **Configuration Storage:**
    *   **New Database Table:** `app_configurations` (Columns: `config_key: str (PK)`, `config_value: str`).
    *   **Alembic Migration:** Script to create `app_configurations` table.

2.  **Configuration Loading Logic (Per-Use Override Approach):**
    *   The global `settings` object (`backend/app/core/config.py`) continues to load from `.env`/defaults (base configuration).
    *   Services/functions needing configuration values (e.g., API keys for `STORMWikiRunner`) will be modified.
    *   A helper function (e.g., `get_effective_setting(db: Session, key: str, default_value: Any)`) will be created:
        *   Tries to fetch the `key` from the `app_configurations` table in the DB.
        *   If found in DB, use that value.
        *   If not found, use the `default_value` (which would be passed from the original `.env` loaded setting, e.g., `settings.OPENAI_API_KEY`).

3.  **CRUD Operations for Configuration (`backend/app/crud.py`):**
    *   `get_config_value(db: Session, key: str) -> models.AppConfiguration | None`
    *   `get_all_config_values(db: Session) -> list[models.AppConfiguration]`
    *   `upsert_config_value(db: Session, key: str, value: str | None) -> models.AppConfiguration`: Creates or updates. If `value` is `None` or empty string, consider deleting the DB entry to revert to `.env`.
    *   `delete_config_value(db: Session, key: str) -> models.AppConfiguration | None`: Explicitly removes a DB override.

4.  **API Endpoints for Admin (`backend/app/main.py` under `admin_router`):
    *   **`GET /admin/config`**: 
        *   Fetches all known configurable keys (defined in `Settings` Pydantic model).
        *   For each key, indicates its current value and whether it's from DB override or `.env`/default.
        *   Example response: `[{"key": "OPENAI_API_KEY", "value": "db_override_xxxx", "source": "database"}, {"key": "LLM_MODEL_NAME", "value": "gpt-3.5-turbo", "source": "env_file"}]`
    *   **`PUT /admin/config`**:
        *   Accepts a dictionary of key-value pairs: `{"OPENAI_API_KEY": "new_db_value", "OTHER_KEY": null}`.
        *   Uses `crud.upsert_config_value`. If a value is `null` or an empty string, it calls `crud.delete_config_value` to remove the DB override, thus reverting to `.env`.

**Frontend Changes:**

1.  **New Admin Page (`AdminConfigPage.js`):**
    *   Route: `/admin/configuration` (or similar).
    *   Fetches data from `GET /admin/config`.
    *   Displays a list/form of known configurable settings (e.g., `OPENAI_API_KEY`, `LLM_MODEL_NAME`, etc. - these should be predefined in the frontend or derived from the API response).
    *   For each setting:
        *   Shows its name (e.g., "OpenAI API Key").
        *   Shows its current value (masked for secrets like API keys).
        *   Indicates its source ("Database Override" or "Environment File / Default").
        *   Provides an input field to set/update the database override.
        *   Provides a button to "Clear Override" (which would send `null` or empty string for that key via `PUT /admin/config` to trigger deletion of DB override).
    *   Submit button calls `PUT /admin/config`.

2.  **Navigation:**
    *   Link in `Navbar.js` admin dropdown to the new configuration page.

**Fallback Mechanism:**
*   When a service needs a config value (e.g., `OPENAI_API_KEY`):
    1. Call `get_effective_setting(db, "OPENAI_API_KEY", settings.OPENAI_API_KEY)`.
    2. The helper tries `crud.get_config_value(db, "OPENAI_API_KEY")`.
    3. If DB returns a value, it's used.
    4. If DB returns `None`, the provided `settings.OPENAI_API_KEY` (from `.env`) is used.
*   This ensures UI-set values take precedence, and clearing them reverts to `.env` values.

**Considerations:**
*   **Security:** Ensure only admins can access these endpoints and that sensitive values (like API keys) are handled carefully (e.g., masked in UI displays, not overly logged).
*   **Restart vs. Dynamic Reload:** This "per-use override" approach avoids needing an application restart for config changes to take effect for new requests/operations.
*   **Known Configurable Keys:** The admin UI should probably operate on a predefined list of keys that are safe and meaningful to expose for runtime configuration. This list can be derived from the Pydantic `Settings` model fields.
*   **Type Coercion:** Values from the DB will be strings. If the original setting in `config.py` is a different type (e.g., int, bool), the `get_effective_setting` helper or the consuming service might need to handle type coercion carefully. 