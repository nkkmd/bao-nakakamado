#!/usr/bin/env python3
# MIT. Public archive extraction boundary tests; no GitHub access or formal game data.
import importlib.util, pathlib, sys, tempfile, unittest, zipfile
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('unzip', pathlib.Path(__file__).with_name('equal-time-worker-unzip.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Boundaries(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = pathlib.Path(self.temp.name)
        self.names = ['session.json', 'lease.json', 'ledger.json', 'seal.json']

    def archive(self, names=None, data=b'{}', symlink=False):
        file = self.base / 'input.zip'
        with zipfile.ZipFile(file, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            for name in names or self.names:
                item = zipfile.ZipInfo(name)
                if symlink:
                    item.external_attr = 0o120777 << 16
                z.writestr(item, data)
        return file

    def reject(self, **args):
        dest = self.base / 'output'
        with self.assertRaises(Exception):
            module.extract(self.archive(**args), dest)
        self.assertFalse(dest.exists())

    def test_valid(self):
        dest = self.base / 'output'
        module.extract(self.archive(), dest)
        self.assertEqual(sorted(p.name for p in dest.iterdir()), sorted(self.names))

    def test_duplicate(self): self.reject(names=self.names + ['seal.json'])
    def test_traversal(self): self.reject(names=self.names + ['../secret.json'])
    def test_absolute(self): self.reject(names=self.names + ['/secret.json'])
    def test_subdirectory(self): self.reject(names=self.names + ['x/pair-0.json'])
    def test_symlink(self): self.reject(symlink=True)
    def test_missing_seal(self): self.reject(names=self.names[:-1])
    def test_non_json(self): self.reject(data=b'invalid json')
    def test_too_many(self): self.reject(names=self.names + [f'pair-{i}.json' for i in range(10)])
    def test_file_limit(self): self.reject(data=b' ' * 8388609)
    def test_unexpected(self): self.reject(names=self.names + ['dataset.zip'])
    def test_existing_destination(self):
        dest = self.base / 'output'
        dest.mkdir()
        (dest / 'existing').write_text('keep')
        with self.assertRaises(Exception): module.extract(self.archive(), dest)
        self.assertEqual((dest / 'existing').read_text(), 'keep')

    def test_crc(self):
        file = self.archive()
        data = bytearray(file.read_bytes())
        # Corrupt first stored file's two-byte JSON without altering the directory.
        index = data.index(b'{}')
        data[index] = ord('x')
        file.write_bytes(data)
        with self.assertRaises(Exception): module.extract(file, self.base / 'output')
        self.assertFalse((self.base / 'output').exists())

if __name__ == '__main__': unittest.main()
