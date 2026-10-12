"""MIT. Extract pinned representatives from preserved original ZIP bytes."""
from pathlib import Path
import zipfile,io,hashlib,json
root=Path(__file__).resolve().parents[2]
p=root/'doc/v010-balance/formal-original-artifacts.zip'
receipt=json.loads((root/'doc/v010-balance/preservation-receipt.json').read_text())
assert hashlib.sha256(p.read_bytes()).hexdigest()==receipt['archiveSha256']
meta=json.loads((root/'doc/v010-balance/formal-artifact-metadata.json').read_text())
byname={a['name']:a for a in meta['artifacts']}
with zipfile.ZipFile(p) as outer:
    for profile,shard in [('primary-8192',0),('low-512',96),('middle-2048',128)]:
        name=f'v010-balance-shard-{shard}';b=outer.read('originals/'+name+'.zip')
        assert hashlib.sha256(b).hexdigest()==byname[name]['sha256']
        with zipfile.ZipFile(io.BytesIO(b)) as inner: data=inner.read(profile+'-0.json.gz')
        dest=root/'tools/v010-followup/inputs'/(profile+'-0.json.gz')
        if dest.exists(): assert dest.read_bytes()==data
        else: dest.write_bytes(data)
