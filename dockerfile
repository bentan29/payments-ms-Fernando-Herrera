FROM node:21-alpine3.19

WORKDIR /usr/src/app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json ./
COPY pnpm-lock.yaml ./    

RUN pnpm install

COPY . .


EXPOSE 3001