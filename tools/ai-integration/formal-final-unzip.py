"""MIT. Pinned archive restoration: export public summary and encrypted final only."""
import hashlib
import json
import pathlib
import stat
import sys
import zipfile


def extract(archive, destination, receipt):
    archive, destination = pathlib.Path(archive), pathlib.Path(destination)
    if destination.exists() or archive.stat().st_size > 128*1024*1024:
        raise ValueError('Destination or ZIP size')
    if 'sha256:'+hashlib.sha256(archive.read_bytes()).hexdigest() != receipt['digest']:
        raise ValueError('Pinned ZIP digest')
    names = {'train.json', 'validation.json', 'collection-summary.json', 'final.sealed.json', 'audit.sealed.json'}
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        if len(entries) != len(names) or {e.filename for e in entries} != names:
            raise ValueError('Archive paths')
        if any(stat.S_ISLNK(e.external_attr >> 16) or e.file_size > 96*1024*1024 for e in entries) or sum(e.file_size for e in entries) > 128*1024*1024:
            raise ValueError('Expanded bounds')
        blobs = {e.filename: z.read(e) for e in entries}  # CRC for all members.
        if hashlib.sha256(blobs['final.sealed.json']).hexdigest() != receipt['finalCiphertextSha256']:
            raise ValueError('Sealed final identity')
        exported = {name: blobs[name] for name in ('collection-summary.json', 'final.sealed.json')}
        for data in exported.values():
            json.loads(data)
    destination.mkdir(parents=True, mode=0o700)
    for name, data in exported.items():
        file = destination/name
        with file.open('xb') as f:
            f.write(data)
        file.chmod(0o600)
    return {'files': sorted(exported), 'finalCiphertextExtracted': True, 'finalOpened': False, 'plainFinalExported': False}


if __name__ == '__main__':
    try:
        spec = json.loads(pathlib.Path(__file__).with_name('formal-final-spec.json').read_text())
        print(json.dumps(extract(sys.argv[1], sys.argv[2], spec['collection'])))
    except Exception:
        sys.stderr.write('Final archive check failed; no payload logged\n')
        sys.exit(1)
