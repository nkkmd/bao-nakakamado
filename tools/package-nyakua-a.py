#!/usr/bin/env python3
"""MIT. Flat, separate device-test ZIPs; frozen public files must match Git blobs."""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TRIAL = ROOT / 'trials/nyakua-a'
PRESERVED = json.loads((TRIAL / 'v0.8.0-preserved.json').read_text())
PUBLIC_FILES = ['index.html', 'app.js', 'style.css', 'next-turn-engine.js', 'steal.js',
                'search-transition.js', 'computer-client.js', 'computer-worker.js',
                'model-search-ai.js', 'browser-model.js', 'search-ai.js', 'search-evaluator.js',
                'README.md', 'licenses.html', 'LICENSE', 'LICENSE-CC-BY-SA-4.0.txt', 'ENGINE_LICENSE.txt']
TRIAL_FILES = ['index.html', 'app.js', 'engine.js', 'rules.js', 'style.css', 'rules.html',
               'RULEBOOK.md', 'README.md', 'licenses.html', 'LICENSE',
               'LICENSE-CC-BY-SA-4.0.txt', 'ENGINE_LICENSE.txt']

def main():
    output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/nyakua-a-zips')
    output.mkdir(parents=True, exist_ok=True)
    for name, expected in PRESERVED['files'].items():
        data = (ROOT / name).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        assert actual == expected, f'Frozen v0.8.0 file changed: {name}'
    reports = []
    for label, directory, files, rule in [
        ('bao-nakakamado-v0.8.0-preserved-20261007', ROOT / 'prototype', PUBLIC_FILES, '0.8.0'),
        ('bao-nakakamado-nyakua-a-trial-001-20261007', TRIAL, TRIAL_FILES, 'nyakua-a-trial-001'),
    ]:
        for license_name in ['LICENSE', 'LICENSE-CC-BY-SA-4.0.txt']:
            assert (directory / license_name).read_bytes() == (ROOT / license_name).read_bytes()
        entries = {name: (directory / name).read_bytes() for name in files}
        for name, data in entries.items():
            if name.endswith('.html'):
                for link in re.findall(r'(?:src|href)="\./([^"?#]+)', data.decode()):
                    assert link in entries, f'Missing packaged link: {name} -> {link}'
        manifest = {'rulesVersion': rule, 'baseCommit': PRESERVED['baseCommit'],
                    'publicAdopted': rule == '0.8.0',
                    'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in entries.items()}}
        entries['manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
        destination = output / (label + '.zip')
        with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in entries.items():
                info = zipfile.ZipInfo(name, (2026, 10, 7, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, data)
        with zipfile.ZipFile(destination) as archive:
            assert archive.testzip() is None
            assert 'index.html' in archive.namelist()
            assert all('/' not in name for name in archive.namelist())
            for name, data in entries.items():
                assert archive.read(name) == data
        reports.append({'file': destination.name, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                        'files': len(entries), 'rulesVersion': rule})
    report = {'status': 'PASS', 'preservedFiles': len(PRESERVED['files']), 'packages': reports}
    (output / 'package-results.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
