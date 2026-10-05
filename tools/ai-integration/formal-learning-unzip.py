"""MIT. Inspect pinned dataset ZIP; extract only public train/validation files."""
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
            raise ValueError('Unexpected or duplicate archive paths')
        if any(stat.S_ISLNK(e.external_attr >> 16) or e.file_size > 96*1024*1024 for e in entries) or sum(e.file_size for e in entries) > 128*1024*1024:
            raise ValueError('Expanded archive bounds')
        # z.read checks CRC; ciphertext is hashed but never decrypted or exported.
        blobs = {e.filename: z.read(e) for e in entries}
        if hashlib.sha256(blobs['final.sealed.json']).hexdigest() != receipt['finalCiphertextSha256']:
            raise ValueError('Sealed final identity')
        visible = {name: blobs[name] for name in ('train.json', 'validation.json', 'collection-summary.json')}
        for data in visible.values():
            json.loads(data)
    destination.mkdir(parents=True, mode=0o700)
    for name, data in visible.items():
        file = destination/name
        with file.open('xb') as f:
            f.write(data)
        file.chmod(0o600)
    return {'files': sorted(visible), 'finalExtracted': False, 'finalOpened': False}


def extract_checkpoint(archive, destination, receipt):
    archive, destination = pathlib.Path(archive), pathlib.Path(destination)
    if destination.exists() or archive.stat().st_size > 128*1024*1024:
        raise ValueError('Checkpoint destination/size')
    if 'sha256:'+hashlib.sha256(archive.read_bytes()).hexdigest() != receipt['digest']:
        raise ValueError('Checkpoint ZIP digest')
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        names = [e.filename for e in entries]
        if 'checkpoint.json' not in names or len(set(names)) != len(names) or not set(names) <= {'checkpoint.json', 'model.json', 'training.json'}:
            raise ValueError('Checkpoint archive paths')
        if any(stat.S_ISLNK(e.external_attr >> 16) for e in entries) or sum(e.file_size for e in entries) > 128*1024*1024:
            raise ValueError('Checkpoint expanded bounds')
        blobs = {e.filename: z.read(e) for e in entries}
        for data in blobs.values():
            json.loads(data)
    destination.mkdir(parents=True, mode=0o700)
    for name, data in blobs.items():
        file = destination/name
        with file.open('xb') as f:
            f.write(data)
        file.chmod(0o600)
    return {'restoredCheckpoint': True}


if __name__ == '__main__':
    try:
        if len(sys.argv) == 4:
            print(json.dumps(extract_checkpoint(sys.argv[1], sys.argv[2], json.loads(pathlib.Path(sys.argv[3]).read_text()))))
        else:
            spec = json.loads(pathlib.Path(__file__).with_name('formal-learning-spec.json').read_text())
            print(json.dumps(extract(sys.argv[1], sys.argv[2], spec['collection'])))
    except Exception:
        sys.stderr.write('Learning ZIP restore failed; no payload logged\n')
        sys.exit(1)
