"""Scene-local, reproducible Foley mix. No music input. 48 kHz stereo PCM."""
from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile
R=Path(__file__).resolve().parent.parent;SR=48000
rng=np.random.default_rng(20260912)
names={'click':'click_sfx.mp3','snap':'snap_finger.mp3','latch':'kacha.mp3','whoosh':'woosh.mp3','swipe':'shua_sfx.mp3','wind':'wind_sfx.mp3','confirm':'correct_sfx.mp3'}
samples={};sources=[]
def normalize(x):return x/max(float(np.abs(x).max()),1e-10)
def band(x,lo,hi):return signal.sosfilt(signal.butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),x)
def fade(x,attack=.003,release=.018):
 x=x.copy();a=min(len(x)//2,round(SR*attack));b=min(len(x)//2,round(SR*release))
 if a:x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
 if b:x[-b:]*=np.cos(np.linspace(0,np.pi/2,b))**2
 return x
for name,file in names.items():
 path=R/'sfx'/file
 x=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac','1','-f','f32le','-']),np.float32).astype(float)
 # Trim source silence around the audible event, preserving its attack and decay.
 envelope=np.convolve(np.abs(x),np.ones(240)/240,'same');active=np.flatnonzero(envelope>envelope.max()*.028)
 begin=max(0,int(active[0])-240);end=min(len(x),int(active[-1])+720)
 x=x[begin:end];x=band(x,100,9500)
 samples[name]=normalize(fade(x))
 sources.append({'id':name,'file':'sfx/'+file,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'crop':[begin/SR,end/SR],'origin':'User-provided local SFX'})
def sound(name,duration,rate=1):
 n=round(duration*SR);t=np.arange(n)/SR
 if name in samples:
  base=samples[name];x=np.interp(np.linspace(0,len(base)-1,n)*rate,np.arange(len(base)),base,right=0)
  return fade(x,.002 if name in ['click','snap','latch'] else .012,.035)
 noise=rng.normal(size=n)
 if name=='pen':
  # Dry graphite-like friction; no sustained pitched tone or background bed.
  x=band(noise,900,7100);movement=.38+.62*np.sin(np.pi*np.linspace(0,1,n))**.5
  rough=1+.24*np.sin(2*np.pi*43*t)+.11*np.sin(2*np.pi*97*t)
  return normalize(fade(x*movement*rough,.007,.013))
 if name=='air':return normalize(fade(band(noise,220,6300)*np.sin(np.linspace(0,np.pi,n))**1.8,.012,.05))*.8
 if name=='thump':
  phase=2*np.pi*(58*t+72*.035*(1-np.exp(-t/.035)))
  return normalize(fade(np.sin(phase)*np.exp(-t/.065)+band(noise,200,1900)*np.exp(-t/.016)*.15,.002,.04))
 if name=='tick':return normalize(fade(band(noise,1000,7200)*np.exp(-t/.008),.0008,.01))
 if name=='rain':
  x=np.zeros(n)
  for at in np.arange(.03,duration-.05,.105):
   j=round((at+float(rng.uniform(-.028,.028)))*SR);k=min(round(.07*SR),n-j)
   z=np.arange(k)/SR
   x[j:j+k]+=band(rng.normal(size=k),1200,8400)*np.exp(-z/.009)*float(rng.uniform(.3,.9))
  return normalize(fade(x,.02,.07))
 raise ValueError(name)
# at, duration and pan belong to each scene; the root only concatenates scenes.
cues={str(i).zfill(2):[] for i in range(1,21)}
def add(scene,at,name,duration,level=.15,pan=0,action='',rate=1):
 cues[f'{scene:02d}'].append({'at':at,'sound':name,'duration':duration,'level':level,'pan':pan,'action':action,'rate':rate})
a=add
# The opening point becomes a paper map.
a(1,0,'air',.65,.28,[-.6,.1],'镜头从定位点退开');a(1,.15,'pen',1.5,.095,[-.65,.35],'蓝色路线绘制');a(1,.72,'pen',.9,.11,0,'定位轮廓');a(1,.87,'thump',.2,.18,0,'定位点落位');a(1,2.88,'swipe',.78,.21,[.5,-.2],'地图展开')
a(2,0,'swipe',.65,.24,[-.2,.35],'延续地图展开');a(2,1.42,'click',.11,.1,.2,'实际导览图显现');a(2,3.03,'wind',.7,.22,[0,.4],'推入地图')
a(3,0,'wind',.8,.24,[.4,0],'地图退入手机');a(3,.94,'latch',.17,.21,0,'机身落位');a(3,2.55,'air',.45,.13,[0,.3],'机身旋转');a(3,3.15,'whoosh',.48,.16,[.2,0],'推近搜索框')
a(4,0,'whoosh',.45,.19,0,'搜索栏展开')
for i in range(3):a(4,.65+i*.16,'click',.065,.08+i*.012,-.35,'输入字词',1+i*.06)
for i in range(3):a(4,.63+i*.12,'tick',.045,.065,-.2+i*.15,'搜索结果逐条落位')
a(4,2.1,'pen',.45,.1,[-.5,.5],'选中结果划线');a(4,3.32,'wind',.55,.23,[0,.3],'图书馆匹配切换')
a(5,.3,'pen',1.6,.085,[.45,-.2],'沿真实路径绘制');a(5,.62,'snap',.095,.15,-.2,'目的地钉落位');a(5,1.04,'click',.09,.1,.6,'步行时间显现');a(5,3.05,'air',.65,.18,[.2,-.4],'拉远路线图')
for i in range(5):
 a(6,i*.12,'whoosh',.28,.07,[-.7,.2],'路线条带快速滑入',1+i*.045)
 a(6,.64+i*.12,'tick',.04,.055+i*.008,.25,'路线条带落位')
a(6,1.06,'snap',.09,.13,.05,'少晒路线强调')
a(7,0,'wind',.7,.21,[-.5,0],'太阳旋转入场');a(7,.5,'thump',.19,.16,.25,'温度落位');a(7,1.6,'pen',1.2,.07,[-.3,.5],'天气指向路线');a(7,3.12,'whoosh',.66,.18,[.1,-.65],'太阳移向建筑镜头')
a(8,0,'swipe',.75,.22,[-.3,.2],'建筑落下');a(8,.72,'latch',.16,.19,0,'建筑落位');a(8,.5,'pen',.9,.05,-.5,'日照方向线');a(8,.52,'air',1.02,.09,[0,.4],'阴影展开');a(8,1.3,'pen',1.2,.115,[-.3,.4],'少晒路径绘制')
a(9,0,'wind',.5,.11,-.5,'雨云进入');a(9,.35,'rain',2.85,.045,[-.5,.5],'雨滴落在连廊外');a(9,.2,'swipe',.63,.16,[.2,-.2],'廊顶展开');a(9,.82,'latch',.13,.13,0,'廊柱到位');a(9,1,'pen',1.2,.09,[-.65,.65],'有顶路线连通')
a(10,0,'swipe',.6,.17,[-.5,.5],'坡道展开');a(10,.5,'pen',1.2,.1,[-.65,.6],'无障碍路线');a(10,1.43,'air',1.65,.07,[-.4,.6],'沿坡道滑行')
a(11,0,'air',.65,.17,[.3,-.3],'地图横移');a(11,1.25,'pen',.65,.1,[-.25,.25],'新的路线绘制');a(11,1.91,'click',.085,.1,.1,'路线更新落位');a(11,2.95,'air',.65,.14,[.1,-.3],'地图拉远')
for i in range(4):
 a(12,i*.07,'swipe',.45,.1,-.65+i*.43,'目的地画面错位进入',1+i*.04)
 a(12,.85+i*.13,'click',.07,.08,-.65+i*.43,'地点钉落位')
a(12,3.05,'wind',.74,.21,[-.6,.6],'四张地图向上接出')
a(13,0,'whoosh',.58,.17,-.5,'教务导入界面');a(13,.83,'click',.1,.16,-.45,'导入按钮点击');a(13,.84,'air',.4,.13,[-.4,.2],'数据转入课程')
for i in range(3):a(13,1.45+i*.17,'latch',.12,.105+i*.015,.45,'课程块依次落位',1+i*.06)
a(13,1.98,'confirm',.22,.095,.4,'导入完成轻提示')
a(14,0,'swipe',.63,.18,[.55,0],'课程展开为周表')
for i in range(7):a(14,.58+i*.06,'tick',.055,.07,-.65+i*.21,'每天课程依次出现',1+i*.035)
a(14,3,'wind',.72,.19,[.1,.6],'推近周一')
a(15,.1,'click',.085,.13,-.4,'周一选中');a(15,1.08,'swipe',.5,.115,.35,'展开全天小节');a(15,2.53,'swipe',.48,.11,.35,'接续下午和晚间');a(15,.65,'thump',.18,.09,-.45,'十三小节落位')
a(16,0,'whoosh',.68,.17,[-.3,0],'课程块拉近');a(16,.73,'click',.085,.18,-.45,'课程地点点击');a(16,.86,'air',.45,.16,[-.3,.55],'地点转到地图');a(16,1.04,'latch',.13,.13,.55,'目的地画面落位');a(16,3.12,'wind',.57,.16,[0,-.65],'课程收回')
a(17,.25,'pen',1.8,.105,[-.7,.7],'校园一天路线接续')
for i in range(4):a(17,.72+i*.25,'click',.085,.1,-.65+i*.43,'日程节点落位',1+i*.07)
a(18,0,'wind',.8,.27,[-.7,.2],'三个界面展开');a(18,.92,'latch',.16,.16,0,'手机阵列到位');a(18,3.08,'swipe',.75,.22,[.65,0],'界面收拢')
for st in json.loads((R/'assets/signature.json').read_text()):
 x=float(st['d'].split('M')[1].split(' ')[0]);pan=max(-.7,min(.7,(x-960)/1000))
 a(19,st['at'],'pen',st['duration'],.115 if st['id'].startswith('letter') else .09,pan,'逐笔书写：'+st['id'])
a(20,0,'air',.58,.18,[-.4,0],'校徽与产品名落版');a(20,.52,'thump',.19,.115,-.4,'校徽落位');a(20,.8,'pen',.6,.085,[-.2,.6],'品牌下方连线');a(20,1.47,'click',.095,.085,.65,'定位点收尾')
(R/'sound/scene-cues.json').write_text(json.dumps(cues,ensure_ascii=False,indent=2)+'\n')
mix=np.zeros((80*SR,2),float);ledger=[]
for scene,items in cues.items():
 for cue in items:
  begin=round(((int(scene)-1)*4+cue['at'])*SR);x=sound(cue['sound'],cue['duration'],cue['rate']);end=begin+len(x)
  assert 0<=begin<end<=len(mix)
  p=cue['pan'];p=p if isinstance(p,list) else [p,p];ang=(np.linspace(*p,len(x))+1)*np.pi/4
  stereo=np.stack([x*np.cos(ang),x*np.sin(ang)],1)*cue['level'];mix[begin:end]+=stereo
  ledger.append({'scene':scene,**cue,'globalStart':begin/SR,'globalEnd':end/SR,'startSample':begin,'endSample':end})
peak=float(np.abs(mix).max());gain=10**(-4/20)/peak;mix*=gain
out=R/'assets/audio/sfx-master.wav';wavfile.write(out,SR,np.round(np.clip(mix,-1,1)*32767).astype(np.int16))
report={'sampleRate':SR,'channels':2,'durationSeconds':80,'sampleCount':len(mix),'bgm':False,'cueCount':len(ledger),'peakDbFS':float(20*np.log10(np.abs(mix).max())),'gainDb':float(20*np.log10(gain)),'sourceFiles':sources,'synthesized':['pen','air','thump','tick','rain'],'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'cues':ledger}
(R/'review/sfx-master.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['cues','sourceFiles']},indent=2))
