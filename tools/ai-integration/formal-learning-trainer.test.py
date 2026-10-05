"""MIT. Development-only numerical and checkpoint tests; no formal rows."""
import importlib.util
import json
import pathlib
import tempfile
import unittest

module_spec = importlib.util.spec_from_file_location('trainer', pathlib.Path(__file__).with_name('formal-learning-trainer.py'))
T = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(T)
np = T.np


class TrainerTests(unittest.TestCase):
    def setUp(self):
        r = np.random.default_rng(17)
        self.x = r.integers(2, size=(13, 7)).astype(float)
        self.y = np.linspace(-.7, .7, 13)
        self.cfg = {**T.SPEC['training'], 'epochs': 3, 'batchSize': 5, 'mlpWidth': 4, 'logicWidth': 5, 'logicDepth': 2}
        self.binding = {'development': True, 'data': T.digest([self.x.tolist(), self.y.tolist()])}

    def session(self, kind):
        return T.Session(kind, 2026100401, self.x, self.y, self.binding, self.cfg)

    def test_resume_mid_batch_boundary_epoch_boundary_and_completed(self):
        for kind in ('mlp', 'logic'):
            continuous = self.session(kind)
            while continuous.step():
                pass
            for count in (2, 3, 9):
                with self.subTest(kind=kind, count=count), tempfile.TemporaryDirectory() as d:
                    first = self.session(kind)
                    for _ in range(count):
                        first.step()
                    file = pathlib.Path(d)/'checkpoint.json'
                    first.save(file)
                    resumed = self.session(kind)
                    resumed.load(file)
                    while resumed.step():
                        pass
                    self.assertEqual(resumed.opt.t, continuous.opt.t)
                    self.assertEqual(resumed.random.bit_generator.state, continuous.random.bit_generator.state)
                    for a, b in zip(resumed.params+resumed.opt.m+resumed.opt.v, continuous.params+continuous.opt.m+continuous.opt.v):
                        np.testing.assert_array_equal(a, b)
                    self.assertEqual(resumed.export(), continuous.export())

    def test_corrupt_changed_runtime_data_config_and_steps_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            file = pathlib.Path(d)/'checkpoint.json'
            session = self.session('logic')
            session.step()
            session.save(file)
            original = json.loads(file.read_text())
            for field in ('digest', 'runtime', 'data', 'config', 'step', 'cursor', 'order', 'shape'):
                saved = json.loads(json.dumps(original))
                p = saved['payload']
                if field == 'digest':
                    saved['digest'] = '0'*64
                elif field == 'runtime':
                    p['binding']['environment']['numpy'] = '0.0.0'
                elif field == 'data':
                    p['binding']['data'] = 'different'
                elif field == 'config':
                    p['binding']['config']['learningRate'] = 1
                elif field == 'step':
                    p['adam']['step'] += 1
                elif field == 'cursor':
                    p['cursor'] = 1
                elif field == 'order':
                    p['order'][0] = p['order'][1]
                else:
                    p['params'][0].pop()
                if field != 'digest':
                    saved['digest'] = T.digest(p)
                T.atomic(file, saved)
                with self.subTest(field=field), self.assertRaises(ValueError):
                    self.session('logic').load(file)

    def test_incomplete_export_and_nonfinite_gradient_rejected(self):
        session = self.session('mlp')
        with self.assertRaises(ValueError):
            session.export()
        with self.assertRaises(ValueError):
            session.opt.step([np.full_like(p, np.nan) for p in session.params])

    def test_logic_backprop_matches_finite_difference_with_reused_inputs(self):
        s = self.session('logic')
        x = self.x[:3]
        h, cache = T.gate_forward(x, s.layers())
        upstream = np.arange(h.size).reshape(h.shape)/10
        gradients = T.gate_backward(upstream, s.layers(), cache, x.shape[1])
        for layer, gradient in zip(s.layers(), gradients):
            logits = layer[2]
            for index in ((0, 0), (0, 1), (3, 15)):
                original = logits[index]
                epsilon = 1e-5
                logits[index] = original+epsilon
                positive = (T.gate_forward(x, s.layers())[0]*upstream).sum()
                logits[index] = original-epsilon
                negative = (T.gate_forward(x, s.layers())[0]*upstream).sum()
                logits[index] = original
                self.assertAlmostEqual(gradient[index], (positive-negative)/(2*epsilon), places=7)

    def test_hard_gate_truth_table_and_dynamic_input_boundary(self):
        x = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        for truth in range(16):
            h = T.hard_features(x, [{'a': [0], 'b': [1], 'gates': [truth]}])
            self.assertEqual(h[:, 0].tolist(), [(truth >> i) & 1 for i in range(4)])
        s = self.session('logic')
        gradients = T.gate_backward(np.ones((len(self.x), 5)), s.layers(), T.gate_forward(self.x, s.layers())[1], 7)
        self.assertEqual(len(gradients), 2)

    def test_ridge_quantization_integer_saturation_and_antisymmetry(self):
        w, b = T.ridge(self.x, self.y, .01)
        self.assertTrue(np.isfinite(w).all() and np.isfinite(b))
        with self.assertRaises(ValueError):
            T.quantize(np.array([np.inf]), 4096)
        with self.assertRaises(ValueError):
            T.quantize(np.array([1000000.]), 4096)
        model = {'kind': 'linear', 'quantizationScale': 4096, 'weights': [100000]*7, 'bias': -400000}
        own = np.ones((1, 7), dtype=int)
        other = np.zeros((1, 7), dtype=int)
        self.assertEqual(T.predict(model, own, other).tolist(), [1024])
        self.assertEqual(T.predict(model, other, own).tolist(), [-1024])


if __name__ == '__main__':
    unittest.main(verbosity=2)
