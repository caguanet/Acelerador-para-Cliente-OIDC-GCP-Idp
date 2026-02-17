import { execSync } from 'child_process';

const PORTS_TO_KILL = [3000, 5173];

function killPort(port: number) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1]; 
          if (pid) {
             execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          }
        }
      }
    } else {
       execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore
  }
}

async function globalTeardown() {
  console.log('[\u001b[32mTEARDOWN\u001b[39m] Cleaning up ports...');
  for (const port of PORTS_TO_KILL) {
    killPort(port);
  }
}

export default globalTeardown;
