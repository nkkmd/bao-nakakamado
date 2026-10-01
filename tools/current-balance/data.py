#!/usr/bin/env python3
"""Pack or restore the exact JSON checkpoint files for an archived study."""
from pathlib import Path
import gzip
import hashlib
import json
import sys

mode, directory, archive = sys.argv[1:]
root = Path(directory)
archive = Path(archive)
if mode == 'pack':
    files = []
    for p in sorted(root.glob('*/*.json')):
        data = p.read_bytes()
        files.append({'path': p.relative_to(root).as_posix(),
                      'sha256': hashlib.sha256(data).hexdigest(), 'content': data.decode('utf-8')})
    assert len([x for x in files if x['path'].endswith('/summary.json')]) == 14
    payload = json.dumps({'format': 'current-balance-checkpoints', 'version': 1, 'files': files},
                         ensure_ascii=False, separators=(',', ':')).encode()
    archive.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    print(json.dumps({'files': len(files), 'bytes': archive.stat().st_size,
                      'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
elif mode == 'unpack':
    record = json.loads(gzip.decompress(archive.read_bytes()))
    assert record['format'] == 'current-balance-checkpoints' and record['version'] == 1
    paths = set()
    for item in record['files']:
        relative = Path(item['path'])
        assert not relative.is_absolute() and '..' not in relative.parts and len(relative.parts) == 2
        assert item['path'] not in paths
        paths.add(item['path'])
        data = item['content'].encode('utf-8')
        assert hashlib.sha256(data).hexdigest() == item['sha256']
        p = root / relative
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    print(json.dumps({'restoredFiles': len(paths)}))
else:
    raise ValueError('Expected pack or unpack')
