FROM node:20

WORKDIR /workspace/ellipsis

COPY . .
RUN npm install