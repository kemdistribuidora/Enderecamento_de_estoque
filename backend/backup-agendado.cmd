@echo off
rem Backup diario do Turso remoto (agendado no Agendador de Tarefas do Windows).
rem Credenciais em backend\.env.backup (fora do git). Log em ..\..\backups-enderecamento\backup.log
cd /d "%~dp0"
if not exist "..\..\backups-enderecamento" mkdir "..\..\backups-enderecamento"
call npx tsx src\scripts\backup.ts --env .env.backup >> "..\..\backups-enderecamento\backup.log" 2>&1
