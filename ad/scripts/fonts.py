from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parent.parent
text=''.join(p.read_text() for p in root.rglob('*.tsx'))+''.join(p.read_text() for p in (root/'assets').glob('*.json'))
for src,index,name in [('/System/Library/Fonts/SFNS.ttf',None,'SF'),(root.parent/'fonts/STHeiti.ttc',1,'Heiti'),(root.parent/'fonts/Montserrat-Medium.ttf',None,'Montserrat')]:
 font=TTFont(src,fontNumber=index) if index is not None else TTFont(src)
 for table in ['fvar','gvar','avar','HVAR','MVAR','VVAR','STAT']:
  if table in font: del font[table]
 options=subset.Options();options.flavor='woff';options.notdef_glyph=True
 sub=subset.Subsetter(options=options);sub.populate(text=text);sub.subset(font)
 font.flavor='woff';font.save(root/'assets/fonts'/f'{name}.woff')
 print(name,(root/'assets/fonts'/f'{name}.woff').stat().st_size)
