## Instalar e Configurar Redis

O Bull requer Redis para funcionar. Instale o Redis:

### Windows:
```bash
# Opção 1: Usar WSL (recomendado)
wsl --install
# Depois no WSL:
sudo apt-get install redis-server
sudo service redis-server start

# Opção 2: Usar Memurai (Redis para Windows)
# Download: https://www.memurai.com/
```

### Linux/Mac:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
```

## Executar Migrations do Banco de Dados

```bash
node server/runMigrations.js
```

## Iniciar o Worker de Processamento OCR

O worker precisa rodar em um processo separado do servidor principal:

```bash
# Terminal 1: Servidor principal
node server/app.js

# Terminal 2: Worker OCR
node server/workers/ocrWorker.js
```

**IMPORTANTE**: O worker deve estar sempre rodando para processar PDFs!

## Configuração em Produção (VPS)

### Usando PM2:

```bash
# Instalar PM2
npm install -g pm2

# Criar arquivo de configuração PM2
```

Crie `ecosystem.config.js`:

module.exports = {
  apps: [
    {
      name: 'etics-api',
      script: 'server/app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'etics-ocr-worker',
      script: 'server/workers/ocrWorker.js',
      instances: 2, // Número de workers paralelos
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

Iniciar com PM2:

pm2 start ecosystem.config.js
pm2 save
pm2 startup

## Testar o Sistema

# 1. Inicie o Redis


# 2. Execute as migrations
node server/runMigrations.js

# 3. Inicie o servidor
node server/app.js

# 4. Em outro terminal, inicie o worker
node server/workers/ocrWorker.js