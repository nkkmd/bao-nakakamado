"""MIT. Production-width two-epoch smoke on previously viewed development paths."""
import hashlib
import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
module_spec = importlib.util.spec_from_file_location('trainer', ROOT/'formal-learning-trainer.py')
T = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(T)
from learning_input import encode
np = T.np


def verify(file, output):
    data = json.loads(pathlib.Path(file).read_text())
    rows = data['rows']
    for row in rows:
        if row['input'] != encode(row['state'], row['state']['player']) or row['opponentInput'] != encode(row['state'], 1-row['state']['player']):
            raise ValueError('Independent Python input mismatch')
    x = np.array([v for r in rows for v in (r['input'], r['opponentInput'])], dtype=float)
    y = np.array([v for r in rows for v in (r['target'], -r['target'])], dtype=float)
    cfg = {**T.SPEC['training'], 'epochs': 2, 'batchSize': 8}
    binding = {'development': True, 'learningFingerprint': data['learningFingerprint'], 'fixtureDigest': T.digest(rows)}
    expected, resume = {}, []
    for kind in T.SPEC['models']:
        for seed in T.SPEC['training']['seeds']:
            directory = pathlib.Path(output)/f'learning-{kind}-{seed}'
            if kind == 'linear':
                w, b = T.ridge(x, y, cfg['ridgeLambda'])
                fields = {'weights': T.quantize(w, 4096), 'bias': T.quantize(np.array([b]), 4096)[0]}
            else:
                continuous = T.Session(kind, seed, x, y, binding, cfg)
                while continuous.step():
                    pass
                interrupted = T.Session(kind, seed, x, y, binding, cfg)
                for _ in range(3):
                    interrupted.step()
                checkpoint = directory/'checkpoint.json'
                interrupted.save(checkpoint)
                restarted = T.Session(kind, seed, x, y, binding, cfg)
                restarted.load(checkpoint)
                while restarted.step():
                    pass
                for a, b in zip(continuous.params+continuous.opt.m+continuous.opt.v, restarted.params+restarted.opt.m+restarted.opt.v):
                    np.testing.assert_array_equal(a, b)
                if restarted.export() != continuous.export():
                    raise ValueError('Export resume mismatch')
                resume.append({'kind': kind, 'seed': seed, 'exact': True})
                fields = restarted.export()
            model = {'schema': 1, 'specId': T.SPEC['id'], 'inputSize': 368, 'encodingId': T.SPEC['encodingId'],
                     'kind': kind, 'seed': seed, 'learningFingerprint': data['learningFingerprint'],
                     'trainDigest': T.digest(rows), 'quantizationScale': 4096, **fields}
            T.atomic(directory/'model.json', model)
            expected[f'{kind}-{seed}'] = T.predict(model, [r['input'] for r in rows], [r['opponentInput'] for r in rows]).tolist()
    T.atomic(pathlib.Path(output)/'python-expected.json', expected)
    return {'scope': 'development-only-two-epoch-not-formal-training', 'environment': T.environment(),
            'rows': len(rows), 'independentViews': len(rows)*2, 'resume': resume, 'formalRowsRead': 0, 'finalOpened': False}


if __name__ == '__main__':
    print(json.dumps(verify(sys.argv[1], sys.argv[2])))
