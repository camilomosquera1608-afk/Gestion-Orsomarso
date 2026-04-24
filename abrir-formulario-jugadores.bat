@echo off
cd /d %~dp0
if not exist node_modules (
  echo Instalando dependencias...
  npm install
)
start "" http://localhost:3000/wellness-jugadores
npm run dev
