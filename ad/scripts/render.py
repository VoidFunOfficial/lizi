"""Render independent Fourier artifacts via the public Core host, then losslessly join."""
from pathlib import Path
import subprocess,sys,json,time,os,shutil
root=Path(__file__).resolve().parent.parent
ids=sorted(p.parent.name for p in root.glob('**/Visual.tsx') if 'node_modules' not in p.parts)
if len(sys.argv)>1:ids=[s for s in ids if any(s.startswith(a) for a in sys.argv[1:])]
for name in ids:
 print(json.dumps({'scene':name,'state':'rendering'}),flush=True)
 env={**os.environ,'FOURIER_DOM_TIMEOUT_MS':'60000'}
 with (root/'review'/f'{name}.render.log').open('w') as log:
  subprocess.run(['bun','scripts/render-one.ts',name],cwd=root,stdout=log,stderr=subprocess.STDOUT,env=env,check=True,timeout=600)
 (root/'assets/rendered').mkdir(parents=True,exist_ok=True)
 shutil.copy2(root/'review'/f'{name}.mp4',root/'assets/rendered'/f'{name}.mp4')
 scene_dir=root/('templates/student-life/scenes' if int(name[:2])>10 else 'scenes')/name
 shutil.copy2(root/'review'/f'{name}.mp4',scene_dir/'rendered.mp4')
 print(json.dumps({'scene':name,'state':'complete'}),flush=True)
if len(ids)==20:
 manifest=root/'review/concat.txt'
 manifest.write_text(''.join(f"file '{root}/review/{name}.mp4'\n" for name in ids))
 subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(manifest),'-i',str(root/'assets/audio/sfx-master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-movflags','+faststart',str(root/'output/NJustMap-1080p60-SFX.mp4')],check=True)
