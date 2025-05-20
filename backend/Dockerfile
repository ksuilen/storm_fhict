# Gebruik een officiële Python runtime als parent image
FROM python:3.11-slim

# Zet de werkdirectory in de container
WORKDIR /app

# Kopieer het requirements bestand en installeer de dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopieer de rest van de backend applicatie code
COPY . .

# Commando om de applicatie te starten wanneer de container start
# We gebruiken Uvicorn, zoals gespecificeerd in requirements.txt
# De host 0.0.0.0 zorgt ervoor dat de applicatie bereikbaar is binnen het Docker netwerk
# De poort 8000 is een gebruikelijke poort voor backend services.
# Zorg ervoor dat 'app.main:app' verwijst naar je FastAPI applicatie instantie.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 