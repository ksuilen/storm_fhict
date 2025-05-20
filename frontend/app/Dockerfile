# STAGE 1: Build de React applicatie
FROM node:20-alpine as build

WORKDIR /app

# Declareer een build argument
ARG REACT_APP_API_URL_ARG

# Zet de environment variabele voor het build proces op basis van het build argument
ENV REACT_APP_API_URL=$REACT_APP_API_URL_ARG

# Kopieer package.json en package-lock.json (of yarn.lock)
COPY package.json ./
# Als je package-lock.json gebruikt:
COPY package-lock.json ./
# Als je yarn.lock gebruikt (en yarn gebruikt voor installatie):
# COPY yarn.lock ./

# Installeer project dependencies
RUN npm install
# Of als je yarn gebruikt:
# RUN yarn install --frozen-lockfile

# Kopieer de rest van de applicatie code
COPY . .

# Print de env var voor debuggen (optioneel, kun je later verwijderen)
RUN echo "Build-time Dockerfile REACT_APP_API_URL: $REACT_APP_API_URL"

# Build de applicatie voor productie
RUN npm run build

# STAGE 2: Serve de statische bestanden met Nginx
FROM nginx:stable-alpine

# Kopieer de build output van de 'build' stage naar de Nginx HTML directory
COPY --from=build /app/build /usr/share/nginx/html

# Optioneel: Kopieer een custom Nginx configuratie.
# Maak een 'nginx.conf' bestand in 'frontend/app/' als je dit nodig hebt.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose poort 80 (standaard Nginx poort)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 