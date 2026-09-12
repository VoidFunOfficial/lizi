from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from scipy.io import wavfile
root=Path(__file__).resolve().parent.parent
video=root/'output/NJustMap-1080p60-SFX.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'],int(v['nb_frames']))==(1920,1080,'60/1',4800)
assert abs(float(probe['format']['duration'])-80)<.05
assert int(a['sample_rate'])==48000 and a['channels']==2
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
rate,pcm=wavfile.read(root/'assets/audio/sfx-master.wav')
assert rate==48000 and pcm.shape==(3840000,2) and np.abs(pcm.astype(float)).max()<32767
report=json.loads((root/'review/sfx-master.json').read_text())
assert report['bgm'] is False and report['cueCount']==114
assert all('bgm' not in s['file'].lower() for s in report['sourceFiles'])
strokes=json.loads((root/'assets/signature.json').read_text());writing=[c for c in report['cues'] if c['scene']=='19']
assert len(strokes)==len(writing)==11
for stroke,cue in zip(strokes,writing):
 assert abs(cue['globalStart']-(72+stroke['at']))<1/48000
 assert abs(cue['duration']-stroke['duration'])<1/48000
result={'file':str(video),'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'frames':int(v['nb_frames']),'seconds':float(probe['format']['duration']),'audioCodec':a['codec_name'],'audioSampleRate':a['sample_rate'],'audioChannels':a['channels'],'cueCount':114,'handwritingStrokes':11,'bgm':False,'decode':'passed','pcmClipping':'none','handwritingSync':'sample-accurate'}
(root/'review/media-acceptance.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
