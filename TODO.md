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