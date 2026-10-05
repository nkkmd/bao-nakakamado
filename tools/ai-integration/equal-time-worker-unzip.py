#!/usr/bin/env python3
# MIT. Inspect all entries, bounds, JSON and CRC before creating a new destination.
import json, pathlib, re, stat, sys, zipfile

def extract(archive, destination):
    archive, destination = pathlib.Path(archive), pathlib.Path(destination)
    assert not destination.exists() and archive.stat().st_size <= 33554432
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        names = [x.filename for x in entries]
        assert 4 <= len(entries) <= 13 and len(set(names)) == len(names)
        assert {'session.json', 'lease.json', 'ledger.json', 'seal.json'} <= set(names)
        assert sum(x.file_size for x in entries) <= 67108864
        contents = {}
        for x in entries:
            assert x.filename in {'session.json', 'lease.json', 'ledger.json', 'seal.json', 'active.json'} or re.fullmatch(r'pair-(0|[1-9][0-9]{0,2})\.json', x.filename)
            assert not x.is_dir() and not stat.S_ISLNK(x.external_attr >> 16)
            assert not x.flag_bits & 1 and x.compress_type in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}
            assert 0 < x.file_size <= 8388608
            data = z.read(x)  # verifies CRC
            json.loads(data)
            contents[x.filename] = data
    destination.mkdir(parents=True)
    for name, data in contents.items():
        (destination / name).write_bytes(data)

if __name__ == '__main__':
    extract(*sys.argv[1:])
