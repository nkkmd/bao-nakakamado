#!/usr/bin/env python3
"""MIT. Package only v0.9.0 runtime assets and verify the preserved v0.8.0."""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'prototype'
FILES = ['index.html', 'app.js', 'style.css', 'end-pit-engine.js', 'end-pit-rules.js',
         'rules.html', 'RULEBOOK.md', 'README.md', 'licenses.html', 'LICENSE',
         'LICENSE-CC-BY-SA-4.0.txt', 'ENGINE_LICENSE.txt']

def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/bao-v090')
    out.mkdir(parents=True, exist_ok=True)
    preserved = json.loads((ROOT / 'trials/nyakua-a/v0.8.0-preserved.json').read_text())
    for name, expected in preserved['files'].items():
        data = (ROOT / 'trials/v0.8.0' / Path(name).name).read_bytes()
        assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == expected, name
    for name in ['LICENSE', 'LICENSE-CC-BY-SA-4.0.txt']:
        assert (PUBLIC / name).read_bytes() == (ROOT / name).read_bytes()
    data = {name: (PUBLIC / name).read_bytes() for name in FILES}
    for name, content in data.items():
        if name.endswith('.html'):
            for link in re.findall(r'(?:src|href)="\./([^"?#]+)', content.decode()):
                assert link in data, f'Missing packaged link {name}: {link}'
    html = data['index.html'].decode()
    assert '試作 v0.9.0' in html and 'search-computer' not in html
    assert '独自ルールの NYAKUA' in html and 'オリジナルの Bao' in html
    assert re.findall(r'<script[^>]+src="\./([^"?]+)', html) == ['end-pit-engine.js', 'end-pit-rules.js', 'app.js']
    manifest = {'rulesVersion': '0.9.0', 'recordVersion': 8, 'publicAdopted': True,
                'computer': 'simple', 'preservedPublicCommit': preserved['baseCommit'],
                'sha256': {name: hashlib.sha256(content).hexdigest() for name, content in data.items()}}
    data['manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    target = out / 'bao-nakakamado-v0.9.0-flat-20261007.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in data.items():
            info = zipfile.ZipInfo(name, (2026, 10, 7, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, content)
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert 'index.html' in archive.namelist()
        assert all('/' not in name for name in archive.namelist())
        for name, content in data.items():
            assert archive.read(name) == content
    result = {'status': 'PASS', 'rulesVersion': '0.9.0', 'recordVersion': 8,
              'preservedFiles': len(preserved['files']), 'file': target.name, 'files': len(data),
              'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    (out / 'package-results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))

if __name__ == '__main__':
    main()
