@echo off
echo Starting CAP Portal (Option B)...
echo.

echo [1/2] Starting backend (FastAPI)...
start "CAP Backend" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt -q && python -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend dev server...
start "CAP Frontend" cmd /k "cd /d %~dp0frontend && python dev-server.py 8765"

echo.
echo Portal running at:
echo   Frontend: http://localhost:8765
echo   Backend:  http://localhost:8000
echo   API docs: http://localhost:8000/docs
echo.
echo Dev mode is ON - click "Dev Login" in the wallet modal to test without a real wallet.
pause
