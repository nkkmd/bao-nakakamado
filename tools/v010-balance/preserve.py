"""MIT. Pin, download and preserve original ZIP bytes; never measure games."""
from pathlib import Path
import os,json,urllib.request,urllib.error,hashlib,zipfile,concurrent.futures,sys
root=Path(__file__).resolve().parents[2];out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
meta=json.loads((root/'doc/v010-balance/formal-artifact-metadata.json').read_text())
assert meta['runId']==38141114334 and len(meta['artifacts'])==161
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(NoRedirect)
def fetch(a):
    url=f"https://api.github.com/repos/nkkmd/bao-nakakamado/actions/artifacts/{a['id']}/zip"
    request=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
    try:
        response=opener.open(request,timeout=60);data=response.read()
    except urllib.error.HTTPError as e:
        if e.code not in (301,302,303,307,308): raise
        redirect=e.headers['Location'];assert redirect.startswith('https://')
        # Do not forward the GitHub credential to the signed storage URL.
        data=urllib.request.urlopen(redirect,timeout=60).read()
    assert len(data)==a['size'],a['name']
    assert hashlib.sha256(data).hexdigest()==a['sha256'],a['name']
    file=out/(a['name']+'.zip');file.write_bytes(data)
    with zipfile.ZipFile(file) as z:
        for name in z.namelist():
            p=Path(name);assert not p.is_absolute() and '..' not in p.parts
            if name.endswith('/') : continue
            dest=out/'data'/p;dest.parent.mkdir(parents=True,exist_ok=True);b=z.read(name)
            if dest.exists(): assert dest.read_bytes()==b,name
            else: dest.write_bytes(b)
    return a['name']
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    for i,name in enumerate(pool.map(fetch,meta['artifacts']),1): print(f'verified original {i}/161: {name}',flush=True)
assert len(list((out/'data').glob('*.json.gz')))==5120
