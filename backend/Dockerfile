# Gebruik een officiële Python runtime als parent image
FROM python:3.11-slim

# Installeer git voor submodule support
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Zet de werkdirectory in de container
WORKDIR /app

# Kopieer het requirements bestand en installeer de dependencies
COPY requirements.txt .
RUN pip install --timeout 600 -r requirements.txt

# Kopieer de rest van de backend applicatie code
COPY . .

# Initialiseer git submodules als ze bestaan
RUN if [ -f .gitmodules ]; then git submodule update --init --recursive; fi

# Commando om de applicatie te starten wanneer de container start
# We gebruiken Uvicorn, zoals gespecificeerd in requirements.txt
# De host 0.0.0.0 zorgt ervoor dat de applicatie bereikbaar is binnen het Docker netwerk
# De poort 8000 is een gebruikelijke poort voor backend services.
# Zorg ervoor dat 'app.main:app' verwijst naar je FastAPI applicatie instantie.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 