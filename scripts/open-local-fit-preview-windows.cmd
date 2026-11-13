@echo off
setlocal
cd /d "%~dp0.."
echo.
echo Runner's Rings - FIT local PC preview (synthetic FIT only)
echo This opens on THIS PC only. No public site or iPhone LAN.
echo Do not select private race files before independent audit.
echo.
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 (
    py -3 -u "scripts\serve-private-fit-preview.py" --host 127.0.0.1 --port 0 --open-browser
    goto finished
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>nul
  if not errorlevel 1 (
    python -u "scripts\serve-private-fit-preview.py" --host 127.0.0.1 --port 0 --open-browser
    goto finished
  )
)
echo Python 3 is required on this PC. No changes were made.
:finished
echo.
echo Preview is stopped. This window may now be closed.
pause
endlocal
