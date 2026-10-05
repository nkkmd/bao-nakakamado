"""MIT. ZIP boundary tests on fabricated blobs; no real final data."""
import hashlib
import importlib.util
import json
import pathlib
import stat
import tempfile
import unittest
import zipfile

module_spec = importlib.util.spec_from_file_location('extractor', pathlib.Path(__file__).with_name('formal-learning-unzip.py'))
U = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(U)


class ArchiveTests(unittest.TestCase):
    def create(self, file, extra=None, symlink=False):
        with zipfile.ZipFile(file, 'w') as z:
            for name in ('train.json', 'validation.json', 'collection-summary.json', 'final.sealed.json', 'audit.sealed.json'):
                entry = zipfile.ZipInfo(name)
                if symlink and name == 'train.json':
                    entry.create_system = 3
                    entry.external_attr = (stat.S_IFLNK | 0o777) << 16
                z.writestr(entry, b'{}')
            if extra:
                z.writestr(extra, b'{}')
        return {'digest': 'sha256:'+hashlib.sha256(file.read_bytes()).hexdigest(),
                'finalCiphertextSha256': hashlib.sha256(b'{}').hexdigest()}

    def test_dataset_extracts_only_three_visible_files(self):
        with tempfile.TemporaryDirectory() as d:
            file, out = pathlib.Path(d)/'dataset.zip', pathlib.Path(d)/'visible'
            receipt = self.create(file)
            result = U.extract(file, out, receipt)
            self.assertFalse(result['finalOpened'])
            self.assertFalse(result['finalExtracted'])
            self.assertEqual({p.name for p in out.iterdir()}, {'train.json', 'validation.json', 'collection-summary.json'})

    def test_bad_hash_path_symlink_and_ciphertext_write_nothing(self):
        for mode in ('digest', 'path', 'symlink', 'ciphertext', 'duplicate'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as d:
                file, out = pathlib.Path(d)/'dataset.zip', pathlib.Path(d)/'visible'
                receipt = self.create(file, extra='../outside.json' if mode == 'path' else 'train.json' if mode == 'duplicate' else None,
                                      symlink=mode == 'symlink')
                if mode == 'digest':
                    receipt['digest'] = 'sha256:'+'0'*64
                if mode == 'ciphertext':
                    receipt['finalCiphertextSha256'] = '0'*64
                with self.assertRaises(ValueError):
                    U.extract(file, out, receipt)
                self.assertFalse(out.exists())

    def test_checkpoint_allows_partial_run_but_rejects_extra_payload(self):
        with tempfile.TemporaryDirectory() as d:
            file, out = pathlib.Path(d)/'checkpoint.zip', pathlib.Path(d)/'restored'
            with zipfile.ZipFile(file, 'w') as z:
                z.writestr('checkpoint.json', '{}')
            receipt = {'digest': 'sha256:'+hashlib.sha256(file.read_bytes()).hexdigest()}
            self.assertTrue(U.extract_checkpoint(file, out, receipt)['restoredCheckpoint'])
            with zipfile.ZipFile(file, 'a') as z:
                z.writestr('validation.json', '{}')
            receipt = {'digest': 'sha256:'+hashlib.sha256(file.read_bytes()).hexdigest()}
            out2 = pathlib.Path(d)/'invalid'
            with self.assertRaises(ValueError):
                U.extract_checkpoint(file, out2, receipt)
            self.assertFalse(out2.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
