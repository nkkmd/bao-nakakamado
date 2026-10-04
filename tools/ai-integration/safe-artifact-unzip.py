#!/usr/bin/env python3
# MIT. Inspect the complete archive before writing any files.
import json, pathlib, re, stat, sys, zipfile
archive, destination = sys.argv[1:3]
mode = sys.argv[3] if len(sys.argv) > 3 else 'shard'
try:
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        assert len(entries) <= 1024
        names, total = set(), 0
        for item in entries:
            name = item.filename
            assert (name == 'plan.sealed.json' if mode == 'plan' else re.fullmatch(r'(manifest\.json|restore-receipt\.json|request-[0-9]+\.sealed\.json)', name)), 'Unexpected archive path'
            assert name not in names
            assert not stat.S_ISLNK(item.external_attr >> 16)
            assert item.file_size <= (128 if mode == 'plan' else 4) * 1024 * 1024
            total += item.file_size
            assert total <= 128 * 1024 * 1024
            names.add(name)
        assert ('plan.sealed.json' in names and len(names) == 1) if mode == 'plan' else 'manifest.json' in names
        # CRC and JSON checks also precede writes.
        files = [(item.filename, z.read(item)) for item in entries]
        for _, data in files:
            json.loads(data)
        root = pathlib.Path(destination)
        assert not root.exists()
        root.mkdir(mode=0o700, parents=True)
        for name, data in files:
            target = root / name
            with target.open('xb') as f:
                f.write(data)
            target.chmod(0o600)
except Exception:
    sys.stderr.write('Artifact ZIP validation failed; no payload logged\n')
    sys.exit(1)
