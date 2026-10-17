"""MIT. Snapshot all new CJS sources around a single complete local validation run."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def snapshot():
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'tools/v010-table015').glob('*.cjs'))}
before=snapshot()
p=subprocess.run(['node','--expose-gc','--test','--test-reporter=tap','tools/v010-table015/method.test.cjs','tools/v010-table015/check.test.cjs'],cwd=root,capture_output=True,text=True)
log='doc/v010-table015/check-all.log'
(root/log).write_text(p.stdout+p.stderr)
assert p.returncode==0,p.returncode
assert '# tests 8' in p.stdout and '# pass 8' in p.stdout and '# fail 0' in p.stdout
assert snapshot()==before,'source changed during validation'
receipt={'status':'ALL-8-TESTS-PASSED','sources':before,'log':log,'logSha256':hashlib.sha256((root/log).read_bytes()).hexdigest(),'formalJobs':0}
with (root/'doc/v010-table015/validation.json').open('x') as f:f.write(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
