from pathlib import Path
import subprocess,os
r=Path(__file__).resolve().parent.parent
for p in sorted(r.glob('**/Visual.tsx')):
 if 'node_modules' not in p.parts:
  subprocess.run(['bun','scripts/preview.ts',p.parent.name],cwd=r,env={**os.environ,'FOURIER_DOM_TIMEOUT_MS':'60000'},check=True,timeout=180)
