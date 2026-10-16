"""MIT. Restore and reverify completed 013 bytes; never start a proof job."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = sys.argv[3]
RUN = int(sys.argv[4])


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe(name):
    p = PurePosixPath(name)
    assert name and not p.is_absolute() and '..' not in p.parts and '\\' not in name
    return p


def command(*args):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True).stdout


def main():
    directory = Path(sys.argv[1]).resolve()
    result_commit = sys.argv[2]
    receipt = json.loads((directory / 'preservation-receipt.json').read_text())
    assert receipt['sourceCommit'] == SOURCE
    assert int(receipt['runId']) == RUN
    assert receipt['games'] == receipt['newGamesDuringArchive'] == 0
    # Compare preserved files with their actual result-commit Git blobs.
    for file in directory.iterdir():
        if file.is_file():
            data = file.read_bytes()
            blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            object_path = result_commit + ':doc/v010-split013/completed/' + file.name
            assert command('git', 'rev-parse', object_path).strip() == blob
    assert command('git', 'show', SOURCE + ':tools/v010-split013/manifest.json') == (ROOT / 'tools/v010-split013/manifest.json').read_text()
    manifest = json.loads(command('node', 'tools/v010-split013/study.cjs', 'manifest'))
    used = set()
    names = set()
    archives = {}
    for name, digest in receipt['archives'].items():
        data = (directory / safe(name)).read_bytes()
        assert sha(data) == digest
        archive = zipfile.ZipFile(io.BytesIO(data))
        assert len(archive.namelist()) == len(set(archive.namelist()))
        archives[name] = archive
    with tempfile.TemporaryDirectory(prefix='v010-013-reaudit-') as temporary:
        out = Path(temporary)
        for record in receipt['files']:
            name = str(safe(record['file']))
            assert name not in names
            names.add(name)
            parts = []
            for piece in record['pieces']:
                safe(piece['entry'])
                key = (piece['archive'], piece['entry'])
                assert key not in used
                used.add(key)
                data = archives[piece['archive']].read(piece['entry'])
                assert len(data) == piece['bytes'] and sha(data) == piece['sha256']
                parts.append(data)
            data = b''.join(parts)
            assert len(data) == record['bytes'] and sha(data) == record['sha256']
            destination = out / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        assert used == {(name, entry) for name, archive in archives.items() for entry in archive.namelist()}
        expected = (directory / 'summary.json').read_bytes()
        assert (out / 'summary.json').read_bytes() == expected
        # Aggregate uses the fixed verifier and normal engine. It writes only here.
        command('node', '--max-old-space-size=4096', 'tools/v010-split013/study.cjs', 'aggregate', str(out))
        assert (out / 'summary.json').read_bytes() == expected
        for record in receipt['files']:
            assert sha((out / record['file']).read_bytes()) == record['sha256']
        summary = json.loads(expected)
        assert summary['digest'] == manifest['digest']
        assert summary['status'] == 'AUDITED-COMPLETE'
        assert summary['proofJobs'] == manifest['jobs'] and summary['games'] == 0
    result = {'status': 'AUDITED-COMPLETE', 'sourceCommit': SOURCE, 'resultsCommit': result_commit,
              'runId': RUN, 'digest': manifest['digest'], 'verifiedOriginalFiles': len(names),
              'summaryBytesMatch': True, 'regeneratedCertificateBytesMatch': True,
              'proofJobs': manifest['jobs'], 'newGames': 0, 'newProofSearches': 0}
    if len(sys.argv) > 5:
        with Path(sys.argv[5]).open('x') as file:
            file.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
