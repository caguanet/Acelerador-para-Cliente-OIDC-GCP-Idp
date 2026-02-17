import { execSync } from 'child_process';

const PORTS_TO_KILL = [3000, 5173];

function killPort(port: number) {
  try {
    if (process.platform === 'win32') {
      // Find PID listing on the port
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1]; // PID is the last column
          if (pid) {
             console.log(`[\u001b[33mCLEANUP\u001b[39m] Killing PID ${pid} on port ${port}`);
             execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          }
        }
      }
    } else {
      // Linux/Mac
       execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore if no process found or permission errors
  }
}

async function globalSetup() {
  console.log('[\u001b[32mSETUP\u001b[39m] Ensuring environment is clean...');
  for (const port of PORTS_TO_KILL) {
      killPort(port);
  }
}

export default globalSetup;
