#!/bin/bash
# Script para instalar Docker Engine nativo en WSL2 Ubuntu 22.04
# Ejecutar con: sudo bash scripts/install-docker-wsl.sh

set -euo pipefail

echo "=== Instalando Docker Engine en WSL2 Ubuntu ==="

# 1. Dependencias
echo "[1/6] Instalando dependencias..."
apt-get update
apt-get install -y ca-certificates curl gnupg

# 2. Clave GPG de Docker
echo "[2/6] Añadiendo clave GPG de Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Repositorio
echo "[3/6] Añadiendo repositorio Docker..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Instalación
echo "[4/6] Instalando Docker Engine + Compose plugin..."
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Grupo docker para usuario actual
echo "[5/6] Añadiendo usuario horek al grupo docker..."
usermod -aG docker horek

# 6. Iniciar demonio (WSL no usa systemd por defecto)
echo "[6/6] Iniciando demonio Docker..."
service docker start

echo ""
echo "=== Instalación completada ==="
echo "Verificando..."
docker --version
docker compose version
echo ""
echo "IMPORTANTE: Para usar docker sin sudo en esta sesión: newgrp docker"
echo "O cierra y reabre la terminal WSL."
