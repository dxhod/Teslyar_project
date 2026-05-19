@echo off
setlocal

where python >nul 2>nul
if %errorlevel%==0 python scripts\prepare_data.py
if %errorlevel%==0 exit /b 0

where py >nul 2>nul
if %errorlevel%==0 py -3 scripts\prepare_data.py
if %errorlevel%==0 exit /b 0

if exist "%USERPROFILE%\anaconda3\python.exe" "%USERPROFILE%\anaconda3\python.exe" scripts\prepare_data.py
if %errorlevel%==0 exit /b 0

if exist "%USERPROFILE%\miniconda3\python.exe" "%USERPROFILE%\miniconda3\python.exe" scripts\prepare_data.py
if %errorlevel%==0 exit /b 0

echo Could not find Python. Install Python, use Anaconda Prompt, or add Python to PATH.
exit /b 1
