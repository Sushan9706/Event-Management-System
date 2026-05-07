# Nodemon App Crash Fix

## 1. The Error
The application was failing to start with the following error:
```
Error: listen EADDRINUSE: address already in use :::3000
```
This error occurs when another process is already listening on the same port (3000 in this case). This frequently happens if a previous instance of the server didn't shut down correctly or if another application is using that port.

## 2. How it was Fixed

### Immediate Fix
I identified the process using port 3000 and terminated it:
1. Ran `lsof -i :3000` to find the Process ID (PID).
2. Ran `kill -9 <PID>` to force-stop the zombie process.

### Long-term Solution (Code Improvement)
I modified `server.js` to handle this error gracefully. Instead of a raw Node.js crash, the server now:
1. Listens for the `EADDRINUSE` error code.
2. Displays a user-friendly message explaining the problem.
3. Provides actionable instructions on how to free the port or use an alternative one.

## 3. How to avoid this in the future
- **Check for running processes**: If you see this error again, run `lsof -i :3000` to see what is using the port.
- **Environment Variables**: You can start the server on a different port without changing the code by running:
  ```bash
  PORT=3001 npm run dev
  ```
- **Clean Exit**: Ensure you stop the server using `Ctrl+C` in the terminal to allow it to release the port properly.
