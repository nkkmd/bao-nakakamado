"""MIT. Offline exact-byte restoration and replay audit; no new games/searches."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / 'doc/v010-research-completed/index.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    path = PurePosixPath(name)
    assert name and not path.is_absolute() and '..' not in path.parts
    assert '\\' not in name
    return path


def command(*args):
    result = subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)
    return result.stdout


def restore_study(study, out):
    directory = ROOT / study['directory']
    for item in study['files']:
        data = (directory / item['name']).read_bytes()
        assert len(data) == item['bytes'] and digest(data) == item['sha256']
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        assert blob == item['gitBlob']
        # Copies must match the immutable source result commit, not merely this index.
        assert command('git', 'rev-parse', study['resultsCommit'] + ':' + item['sourcePath']).strip() == blob
    receipt = json.loads((directory / 'preservation-receipt.json').read_text())
    assert receipt['sourceCommit'] == study['sourceCommit']
    assert int(receipt['runId']) == study['runId']
    assert receipt['newGamesDuringArchive'] == 0
    assert len(receipt['files']) == study['originalFiles']
    archives = {}
    for name, sha in receipt['archives'].items():
        data = (directory / safe_name(name)).read_bytes()
        assert digest(data) == sha
        archives[name] = zipfile.ZipFile(io.BytesIO(data))
        assert len(archives[name].namelist()) == len(set(archives[name].namelist()))
    used = set()
    seen_files = set()
    for record in receipt['files']:
        name = str(safe_name(record['file']))
        assert name not in seen_files
        seen_files.add(name)
        pieces = []
        for part in record['pieces']:
            safe_name(part['entry'])
            key = (part['archive'], part['entry'])
            assert key not in used
            used.add(key)
            data = archives[part['archive']].read(part['entry'])
            assert len(data) == part['bytes'] and digest(data) == part['sha256']
            pieces.append(data)
        data = b''.join(pieces)
        assert len(data) == record['bytes'] and digest(data) == record['sha256']
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    assert used == {(name, entry) for name, z in archives.items() for entry in z.namelist()}
    assert (out / 'summary.json').read_bytes() == (directory / 'summary.json').read_bytes()
    result = json.loads(command('node', 'tools/v010-research-integration/aggregate.cjs',
                               study['aggregator'], str(out), str(directory / 'summary.json')))
    assert result['games'] == study['games']
    assert result['proofJobs'] == study['proofJobs']
    return {'study': study['number'], 'verifiedOriginalFiles': len(seen_files), **result}


def restore_formal(out):
    directory = ROOT / 'doc/v010-balance'
    receipt = json.loads((directory / 'preservation-receipt.json').read_text())
    data = (directory / 'formal-original-artifacts.zip').read_bytes()
    assert len(data) == receipt['archiveBytes'] and digest(data) == receipt['archiveSha256']
    metadata = json.loads((directory / 'formal-artifact-metadata.json').read_text())
    assert metadata['runId'] == receipt['formalRun'] == 38141114334
    with zipfile.ZipFile(io.BytesIO(data)) as outer:
        assert len(outer.namelist()) == receipt['originalZips'] == len(metadata['artifacts']) == 161
        assert len(set(outer.namelist())) == 161
        expected = {'originals/' + a['name'] + '.zip': a for a in metadata['artifacts']}
        assert set(outer.namelist()) == set(expected)
        for name, item in expected.items():
            raw = outer.read(name)
            assert len(raw) == item['size'] and digest(raw) == item['sha256']
            with zipfile.ZipFile(io.BytesIO(raw)) as inner:
                assert len(inner.namelist()) == len(set(inner.namelist()))
                for filename in inner.namelist():
                    path = safe_name(filename)
                    if filename.endswith('/'):
                        continue
                    target = out / path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    content = inner.read(filename)
                    if target.exists():
                        assert target.read_bytes() == content
                    else:
                        target.write_bytes(content)
    assert len(list(out.glob('*.json.gz'))) == 5120
    result = json.loads(command('node', 'tools/v010-research-integration/aggregate.cjs',
                               'tools/v010-balance/formal.cjs', str(out), str(directory / 'formal-summary.json')))
    assert result['games'] == 10240
    return {'originalZips': 161, 'verifiedPairs': 5120, **result}


def main():
    index = json.loads(INDEX.read_text())
    command('git', 'diff', '--exit-code', index['productionBaseline'], '--', 'prototype', 'trials')
    for source in ['tools/v010-balance/formal.cjs', 'tools/v010-followup/study.cjs',
                   'tools/v010-certainty/study.cjs', 'tools/v010-gc/study.cjs']:
        command('node', source, 'manifest')
    with tempfile.TemporaryDirectory(prefix='v010-completed-') as temporary:
        temp = Path(temporary)
        formal = temp / 'formal'
        formal.mkdir()
        formal_result = restore_formal(formal)
        print(json.dumps({'formal': formal_result}), flush=True)
        studies = []
        for study in index['studies']:
            out = temp / study['number']
            out.mkdir()
            result = restore_study(study, out)
            studies.append(result)
            print(json.dumps(result), flush=True)
    command('node', 'tools/v010-followup/audit-proof-checkpoint.cjs')
    print(json.dumps({'status': 'AUDITED-COMPLETE', 'formal': formal_result, 'studies': studies,
                      'proofCheckpointJobs': 26, 'productionBytesUnchanged': True,
                      'newGames': 0, 'newProofSearches': 0}), flush=True)


if __name__ == '__main__':
    main()
