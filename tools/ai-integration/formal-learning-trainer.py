"""CPU training and exact checkpoint resume; MIT.

Adapted from tools/engineering/train-pbai-p6.py at
8c87ed44c9b08f75456766f0a9bd9f76d06209d4 in bao-la-kiswahili-game.
Copyright (c) 2026 cultivationdata.net; see prototype/ENGINE_LICENSE.txt.
Changes: 368-bit input, train-only contract, version-bound resumable Adam/RNG,
fixed integer MLP inference, and no validation or final-data access.
"""
import os
for _name in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    os.environ[_name] = '1'
import argparse
import hashlib
import json
import pathlib
import platform
import subprocess
import sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent
SPEC = json.loads((ROOT / 'formal-learning-spec.json').read_text())
TABLE = np.array([[(g >> i) & 1 for i in range(4)] for g in range(16)], dtype=np.float64)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def atomic(file, value):
    file = pathlib.Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(file.suffix + '.tmp')
    temporary.write_text(json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n')
    temporary.chmod(0o600)
    temporary.replace(file)


def environment():
    cpu = platform.processor()
    cpuinfo = pathlib.Path('/proc/cpuinfo')
    if cpuinfo.exists():
        cpu = next((line.split(':', 1)[1].strip() for line in cpuinfo.read_text().splitlines() if line.startswith('model name')), cpu)
    return {'python': platform.python_version(), 'numpy': np.__version__, 'platform': platform.system(),
            'machine': platform.machine(), 'cpu': cpu, 'blas': np.__config__.CONFIG, 'threads': 1}


def ridge(x, y, lam):
    xm, ym = x.mean(0), y.mean()
    z = x - xm
    w = np.linalg.solve(z.T @ z + len(x) * lam * np.eye(x.shape[1]), z.T @ (y - ym))
    return w, float(ym - xm @ w)


def softmax(logits):
    p = np.exp(logits - logits.max(1, keepdims=True))
    return p / p.sum(1, keepdims=True)


def gate_forward(x, layers):
    h = np.empty((len(x), 0))
    cache = []
    for a, b, logits in layers:
        pool = np.concatenate((x, h), axis=1)
        u, v = pool[:, a], pool[:, b]
        probs = softmax(logits)
        c = probs @ TABLE
        h = (1-u)*((1-v)*c[:, 0] + v*c[:, 1]) + u*((1-v)*c[:, 2] + v*c[:, 3])
        cache.append((pool, u, v, probs, c))
    return h, cache


def gate_backward(dh, layers, cache, input_size):
    grads = []
    for (a, b, _), (pool, u, v, p, c) in zip(layers[::-1], cache[::-1]):
        dc = np.stack(((dh*(1-u)*(1-v)).sum(0), (dh*(1-u)*v).sum(0),
                       (dh*u*(1-v)).sum(0), (dh*u*v).sum(0)), axis=1)
        dp = dc @ TABLE.T
        grads.append(p * (dp - (dp*p).sum(1, keepdims=True)))
        du = dh*((1-v)*(c[:, 2]-c[:, 0]) + v*(c[:, 3]-c[:, 1]))
        dv = dh*((1-u)*(c[:, 1]-c[:, 0]) + u*(c[:, 3]-c[:, 2]))
        dpool = np.zeros_like(pool)
        np.add.at(dpool, (np.arange(len(pool))[:, None], a[None, :]), du)
        np.add.at(dpool, (np.arange(len(pool))[:, None], b[None, :]), dv)
        dh = dpool[:, input_size:]
    return grads[::-1]


def hard_features(x, layers):
    h = np.empty((len(x), 0), dtype=np.int64)
    for layer in layers:
        pool = np.concatenate((x, h), axis=1).astype(np.int64)
        h = (np.array(layer['gates'])[None, :] >> (2*pool[:, layer['a']] + pool[:, layer['b']])) & 1
    return h


class Adam:
    def __init__(self, params, lr):
        self.params, self.lr = params, lr
        self.m = [np.zeros_like(p) for p in params]
        self.v = [np.zeros_like(p) for p in params]
        self.t = 0

    def step(self, grads):
        if len(grads) != len(self.params):
            raise ValueError('Gradient count')
        self.t += 1
        for p, g, m, v in zip(self.params, grads, self.m, self.v):
            if p.shape != g.shape or not np.isfinite(g).all():
                raise ValueError('Nonfinite or malformed gradient')
            m[:] = .9*m + .1*g
            v[:] = .999*v + .001*g*g
            p -= self.lr*(m/(1-.9**self.t))/(np.sqrt(v/(1-.999**self.t)) + 1e-8)
            if not np.isfinite(p).all():
                raise ValueError('Nonfinite parameter')


class Session:
    def __init__(self, kind, seed, x, y, binding, cfg=None):
        self.cfg = dict(SPEC['training'] if cfg is None else cfg)
        self.kind, self.seed, self.x, self.y = kind, seed, x, y
        self.binding = {**binding, 'kind': kind, 'seed': seed, 'config': self.cfg, 'environment': environment()}
        self.random = np.random.Generator(np.random.PCG64(seed))
        self.epoch, self.cursor, self.order = 0, 0, None
        n = x.shape[1]
        if kind == 'mlp':
            width = self.cfg['mlpWidth']
            self.params = [self.random.normal(0, 1/np.sqrt(n), (n, width)), np.zeros(width),
                           self.random.normal(0, .05, width), np.zeros(1)]
            self.connections = []
        elif kind == 'logic':
            width = self.cfg['logicWidth']
            self.params, self.connections = [], []
            for i in range(self.cfg['logicDepth']):
                pool_size = n + (width if i else 0)
                a, b = self.random.integers(pool_size, size=width), self.random.integers(pool_size, size=width)
                logits = self.random.normal(0, .01, (width, 16))
                logits[np.arange(width), self.random.integers(16, size=width)] += 2
                self.connections.append((a, b))
                self.params.append(logits)
            self.params.extend([self.random.normal(0, .05, width), np.zeros(1)])
        else:
            raise ValueError('Session model kind')
        self.opt = Adam(self.params, self.cfg['learningRate'])

    def layers(self):
        return [(a, b, p) for (a, b), p in zip(self.connections, self.params)]

    def step(self):
        if self.epoch >= self.cfg['epochs']:
            return False
        if self.order is None:
            self.order = self.random.permutation(len(self.x))
        idx = self.order[self.cursor:self.cursor + self.cfg['batchSize']]
        xb, yb = self.x[idx], self.y[idx]
        w2, b2 = self.params[-2:]
        if self.kind == 'mlp':
            h = np.tanh(xb @ self.params[0] + self.params[1])
        else:
            h, cache = gate_forward(xb, self.layers())
        delta = 2*(h @ w2 + b2[0] - yb)/len(xb)
        dh = delta[:, None]*w2
        if self.kind == 'mlp':
            dz = dh*(1-h*h)
            grads = [xb.T @ dz, dz.sum(0)]
        else:
            grads = gate_backward(dh, self.layers(), cache, self.x.shape[1])
        self.opt.step(grads + [h.T @ delta, np.array([delta.sum()])])
        self.cursor += len(idx)
        if self.cursor == len(self.x):
            self.epoch += 1
            self.cursor, self.order = 0, None
        return True

    def save(self, file):
        payload = {'schema': 1, 'binding': self.binding, 'epoch': self.epoch, 'cursor': self.cursor,
                   'order': None if self.order is None else self.order.tolist(), 'rng': self.random.bit_generator.state,
                   'params': [p.tolist() for p in self.params], 'connections': [[a.tolist(), b.tolist()] for a, b in self.connections],
                   'adam': {'step': self.opt.t, 'm': [p.tolist() for p in self.opt.m], 'v': [p.tolist() for p in self.opt.v]}}
        atomic(file, {'digest': digest(payload), 'payload': payload})

    def load(self, file):
        saved = json.loads(pathlib.Path(file).read_text())
        p = saved['payload']
        if saved['digest'] != digest(p) or p['schema'] != 1 or p['binding'] != self.binding:
            raise ValueError('Checkpoint checksum, data, code, runtime or configuration mismatch')
        epoch, cursor = p['epoch'], p['cursor']
        if type(epoch) is not int or not 0 <= epoch <= self.cfg['epochs'] or type(cursor) is not int or not 0 <= cursor < len(self.x):
            raise ValueError('Checkpoint epoch/cursor')
        if cursor % self.cfg['batchSize'] or (cursor == 0) != (p['order'] is None):
            raise ValueError('Checkpoint batch position')
        if p['order'] is not None and sorted(p['order']) != list(range(len(self.x))):
            raise ValueError('Checkpoint permutation')
        if epoch == self.cfg['epochs'] and cursor:
            raise ValueError('Completed checkpoint cursor')
        expected_step = epoch*((len(self.x)+self.cfg['batchSize']-1)//self.cfg['batchSize']) + cursor//self.cfg['batchSize']
        if p['adam']['step'] != expected_step or p['connections'] != [[a.tolist(), b.tolist()] for a, b in self.connections]:
            raise ValueError('Checkpoint step/connections')
        for destination, source in ((self.params, p['params']), (self.opt.m, p['adam']['m']), (self.opt.v, p['adam']['v'])):
            if len(destination) != len(source):
                raise ValueError('Checkpoint parameter count')
            for old, values in zip(destination, source):
                value = np.asarray(values, dtype=np.float64)
                if value.shape != old.shape or not np.isfinite(value).all():
                    raise ValueError('Checkpoint shape or nonfinite value')
                old[:] = value
        if any((v < 0).any() for v in self.opt.v):
            raise ValueError('Checkpoint second moment')
        self.epoch, self.cursor = epoch, cursor
        self.order = None if p['order'] is None else np.asarray(p['order'], dtype=np.int64)
        self.random.bit_generator.state = p['rng']
        self.opt.t = p['adam']['step']

    def export(self):
        if self.epoch != self.cfg['epochs']:
            raise ValueError('Incomplete training cannot export a model')
        s = self.cfg['quantizationScale']
        if self.kind == 'mlp':
            w1, b1, w2, b2 = self.params
            return {'w1': quantize(w1, s), 'b1': quantize(b1, s), 'w2': quantize(w2, s),
                    'b2': quantize(b2, s)[0], 'tanhTable': np.rint(np.tanh(np.arange(-2048, 2049)/256)*s).astype(int).tolist()}
        layers = [{'a': a.tolist(), 'b': b.tolist(), 'gates': p.argmax(1).tolist()} for (a, b), p in zip(self.connections, self.params)]
        w, b = ridge(hard_features(self.x, layers), self.y, self.cfg['ridgeLambda'])
        return {'layers': layers, 'weights': quantize(w, s), 'bias': quantize(np.array([b]), s)[0]}


def quantize(value, scale):
    scaled = np.rint(value*scale)
    if not np.isfinite(scaled).all() or np.max(np.abs(scaled)) > SPEC['training']['maximumIntegerWeight']:
        raise ValueError('Integer weight range')
    return scaled.astype(np.int64).tolist()


def raw_integer(model, x):
    x = np.asarray(x, dtype=np.int64)
    scale = model['quantizationScale']
    if model['kind'] == 'mlp':
        z = x @ np.asarray(model['w1'], dtype=np.int64) + model['b1']
        indexes = np.clip(np.trunc(z/16).astype(np.int64), -2048, 2048) + 2048
        h = np.asarray(model['tanhTable'], dtype=np.int64)[indexes]
        return h @ np.asarray(model['w2'], dtype=np.int64) + model['b2']*scale, scale*scale
    h = hard_features(x, model['layers']) if model['kind'] == 'logic' else x
    return h @ np.asarray(model['weights'], dtype=np.int64) + model['bias'], scale


def predict(model, x, opponent):
    a, den = raw_integer(model, x)
    b, _ = raw_integer(model, opponent)
    return np.trunc(SPEC['targetScale']*(np.clip(a, -den, den)-np.clip(b, -den, den))/(2*den)).astype(np.int64)


def train(input_file, kind, seed, output, maximum_batches=None):
    if kind not in SPEC['models'] or seed not in SPEC['training']['seeds']:
        raise ValueError('Unregistered model/seed')
    if platform.python_version() != SPEC['training']['python'] or np.__version__ != SPEC['training']['numpy']:
        raise ValueError('Pinned Python/NumPy version required')
    subprocess.run(['node', str(ROOT/'formal-learning-data.cjs'), '--check', str(input_file), 'train'], check=True)
    data = json.loads(pathlib.Path(input_file).read_text())
    # Exactly one train-only file. No directory glob or validation-based stopping.
    x = np.asarray([v for r in data['rows'] for v in (r['input'], r['opponentInput'])], dtype=np.float64)
    y = np.asarray([v for r in data['rows'] for v in (r['target'], -r['target'])], dtype=np.float64)
    binding = {'learningFingerprint': data['learningFingerprint'], 'trainDigest': data['digest'],
               'trainFileSha256': hashlib.sha256(pathlib.Path(input_file).read_bytes()).hexdigest()}
    output = pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    checkpoint = output/'checkpoint.json'
    if kind == 'linear':
        w, b = ridge(x, y, SPEC['training']['ridgeLambda'])
        fields = {'weights': quantize(w, SPEC['training']['quantizationScale']),
                  'bias': quantize(np.array([b]), SPEC['training']['quantizationScale'])[0]}
        steps = 0
    else:
        session = Session(kind, seed, x, y, binding)
        if checkpoint.exists():
            session.load(checkpoint)
        done = 0
        try:
            while (maximum_batches is None or done < maximum_batches) and session.step():
                done += 1
                if session.opt.t % SPEC['training']['checkpointEveryBatches'] == 0:
                    session.save(checkpoint)
        finally:
            session.save(checkpoint)
        if session.epoch < SPEC['training']['epochs']:
            return {'status': 'CHECKPOINTED', 'kind': kind, 'seed': seed, 'epoch': session.epoch, 'cursor': session.cursor}
        fields, steps = session.export(), session.opt.t
    model = {'schema': 1, 'specId': SPEC['id'], 'inputSize': SPEC['inputSize'], 'encodingId': SPEC['encodingId'],
             'kind': kind, 'seed': seed, 'learningFingerprint': binding['learningFingerprint'], 'trainDigest': binding['trainDigest'],
             'quantizationScale': SPEC['training']['quantizationScale'], **fields}
    model_file = output/'model.json'
    if model_file.exists() and json.loads(model_file.read_text()) != model:
        raise ValueError('Existing frozen model differs')
    atomic(model_file, model)
    atomic(output/'training.json', {'status': 'TRAINED-NOT-VALIDATED', 'binding': binding, 'environment': environment(),
                                   'kind': kind, 'seed': seed, 'steps': steps, 'modelSha256': hashlib.sha256(model_file.read_bytes()).hexdigest(),
                                   'origin': {'repository': os.environ.get('GITHUB_REPOSITORY', 'local-development'),
                                              'runId': int(os.environ.get('GITHUB_RUN_ID', '0')), 'attempt': int(os.environ.get('GITHUB_RUN_ATTEMPT', '1')),
                                              'headSha': os.environ.get('GITHUB_SHA', 'local-development')},
                                   'formalFinalOpened': False})
    return {'status': 'TRAINED-NOT-VALIDATED', 'kind': kind, 'seed': seed, 'steps': steps}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('train_file')
    parser.add_argument('kind', choices=SPEC['models'])
    parser.add_argument('seed', type=int)
    parser.add_argument('output')
    parser.add_argument('--maximum-batches', type=int)
    args = parser.parse_args()
    try:
        if args.maximum_batches is not None and args.maximum_batches <= 0:
            raise ValueError('Batch budget')
        print(json.dumps(train(args.train_file, args.kind, args.seed, args.output, args.maximum_batches)))
    except Exception:
        sys.stderr.write('Formal training failed; no row payload logged\n')
        sys.exit(1)
