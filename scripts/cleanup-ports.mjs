import { execSync } from 'child_process';

const PORTS = [3000, 5173];

console.log('[\x1b[36mCLEANUP\x1b[0m] Checking for zombie processes on ports:', PORTS.join(', '));

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.split('\n');
      let killed = false;
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1]; 
          if (pid && pid !== '0') {
             try {
                process.stdout.write(`[\x1b[33mKILL\x1b[0m] Port ${port} is held by PID ${pid}. Terminating... `);
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                console.log('\x1b[32mDONE\x1b[0m');
                killed = true;
             } catch (e) {
                console.log('\x1b[31mFAILED\x1b[0m');
             }
          }
        }
      }
    } else {
       // Linux/Mac fallback
       try {
         execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
       } catch (e) {}
    }
  } catch (e) {
    // Netstat returns exit code 1 if no text found, which is partial success (no grep match)
  }
}

PORTS.forEach(killPort);
console.log('[\x1b[32mREADY\x1b[0m] Ports are clear.');
