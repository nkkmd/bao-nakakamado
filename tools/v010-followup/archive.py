"""MIT. Preserve exact completed record bytes in bounded ZIP parts."""
from pathlib import Path
import hashlib,json,zipfile,sys,os
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
cap=45*1024*1024;part=0;size=0;z=None;entries=[];archives=[]
for f in sorted(src.iterdir()):
    if not f.is_file():continue
    b=f.read_bytes();pieces=[]
    for i in range(0,len(b) or 1,cap):
        chunk=b[i:i+cap];name=f.name if len(b)<=cap else f.name+f'.part-{i//cap:03}'
        if z is None or size+len(chunk)>cap:
            if z:z.close()
            part+=1;size=0;name_zip=f'original-records-{part:03}.zip';archives.append(name_zip)
            z=zipfile.ZipFile(out/name_zip,'w',compression=zipfile.ZIP_STORED)
        z.writestr(name,chunk);size+=len(chunk)
        pieces.append({'archive':archives[-1],'entry':name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
    entries.append({'file':f.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'pieces':pieces})
if z:z.close()
summary=json.loads((src/'summary.json').read_text());(out/'summary.json').write_bytes((src/'summary.json').read_bytes())
receipt={'sourceCommit':os.environ.get('STUDY_SOURCE_SHA'),'runId':os.environ.get('STUDY_RUN_ID'),'games':summary['games'],
         'newGamesDuringArchive':0,'files':entries,'archives':{n:hashlib.sha256((out/n).read_bytes()).hexdigest() for n in archives}}
(out/'preservation-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(f'preserved {len(entries)} exact records in {len(archives)} bounded ZIP files')
