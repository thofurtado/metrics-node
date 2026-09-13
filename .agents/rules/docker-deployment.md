# Diretrizes de Deploy e Containerização (Coolify / Docker)

- **Containerização Nativa:** O backend `metrics-node` utiliza um `Dockerfile` multi-stage otimizado na raiz do projeto para o deploy no Coolify.
- **Cache de Dependências:** O `Dockerfile` está estruturado para cachear a camada de `package*.json` e `prisma/`, garantindo que novos deploys que alteram apenas código em `src/` terminem em menos de 45 segundos (pulando o `npm ci`).
- **Compatibilidade Prisma:** A imagem base utiliza `node:22-slim` com `openssl` e certificados instalados, assegurando a compatibilidade total com o Prisma Query Engine sem o overhead e lentidão de compilação do Nixpacks.
- **Não reverter para Nixpacks:** Não remova o `Dockerfile` nem adicione arquivos que forcem o Coolify a reverter para o Nixpacks, para evitar consumo excessivo de CPU, download de pacotes NixOS e deploys lentos (>25 minutos).
