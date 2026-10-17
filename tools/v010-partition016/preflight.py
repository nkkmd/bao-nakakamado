"""MIT. Execute only the thirteen preserved-record audits, never proof jobs."""
import concurrent.futures,json,subprocess,shlex
from pathlib import Path
import yaml
root=Path(__file__).resolve().parents[2]
j=yaml.safe_load((root/'.github/workflows/v010-research-integration-check.yml').read_text())
commands=['python3 tools/v010-research-integration/audit.py']+[r['command'] for r in j['jobs']['completed-004-015']['strategy']['matrix']['include']]
assert len(commands)==13
out=root/'doc/v010-partition016/preflight-logs';out.mkdir(exist_ok=True)
def run(item):
 i,cmd=item
 p=subprocess.run(shlex.split(cmd),cwd=root,capture_output=True,text=True)
 (out/f'audit-{i}.log').write_text(p.stdout+p.stderr)
 assert p.returncode==0,(i,cmd,p.returncode)
 print(json.dumps({'audit':i,'status':'PASS'}),flush=True)
 return {'index':i,'command':cmd,'exitCode':p.returncode,'log':f'preflight-logs/audit-{i}.log'}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(run,enumerate(commands)))
receipt={'status':'ALL-13-AUDITS-PASSED','baseline':subprocess.check_output(['git','rev-parse','origin/main'],cwd=root,text=True).strip(),'audits':rows,'newGames':0,'newProofSearches':0}
p=root/'doc/v010-partition016/preflight-reaudit.json'
with p.open('x') as f:f.write(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt),flush=True)
