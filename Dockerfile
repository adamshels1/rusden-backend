FROM node:18-alpine

# Устанавливаем зависимости для обработки изображений (Sharp)
RUN apk add --no-cache \
    vips-dev \
    fftw-dev \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN npm run build

# Создаем директорию для скриптов и изображений
RUN mkdir -p scripts/images

EXPOSE 3000

CMD ["npm", "start"]
