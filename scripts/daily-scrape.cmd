@echo off
REM Entry point for the Windows scheduled task "SmartCopons Daily Scrape".
REM
REM Task Scheduler starts programs in system32, not the project, so the working
REM directory has to be set here. APP_SECRET is read by the runner from
REM .env.local, which is gitignored — it is never passed on the command line,
REM where it would show up in the task definition and in process listings.

setlocal
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" "scripts\run-daily-scrapers.mjs" %*
exit /b %ERRORLEVEL%
