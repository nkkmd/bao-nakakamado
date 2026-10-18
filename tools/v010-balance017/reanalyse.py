"""MIT. Read original bytes only; no game generation or proof search."""
import importlib.util,json,tempfile,subprocess,zipfile,io,hashlib,sys
sys.dont_write_bytecode=True
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('original_audit',ROOT/'tools/v010-research-integration/audit.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
with tempfile.TemporaryDirectory(prefix='balance017-readonly-') as tmp:
 out=Path(tmp)
 # Verify all archive digests and restore bytes without invoking formal measurement.
 receipt=json.loads((ROOT/'doc/v010-balance/preservation-receipt.json').read_text())
 raw=(ROOT/'doc/v010-balance/formal-original-artifacts.zip').read_bytes()
 assert a.digest(raw)==receipt['archiveSha256']
 metadata=json.loads((ROOT/'doc/v010-balance/formal-artifact-metadata.json').read_text())
 with zipfile.ZipFile(io.BytesIO(raw)) as outer:
  for item in metadata['artifacts']:
   data=outer.read('originals/'+item['name']+'.zip');assert a.digest(data)==item['sha256']
   with zipfile.ZipFile(io.BytesIO(data)) as inner:
    for name in inner.namelist():
     if name.endswith('.json.gz'):
      p=out/a.safe_name(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(inner.read(name))
 assert len(list(out.glob('*.json.gz')))==5120
 subprocess.run(['node','tools/v010-balance017/reanalyse.cjs',str(out)],cwd=ROOT,check=True)
