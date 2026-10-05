"""MIT. Synthetic ZIP boundary checks; no formal archive or collection key."""
import hashlib
import importlib.util
import json
import pathlib
import stat
import tempfile
import unittest
import warnings
import zipfile

module_spec = importlib.util.spec_from_file_location('unzip', pathlib.Path(__file__).with_name('formal-final-unzip.py'))
unzip = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(unzip)


class FinalUnzipTests(unittest.TestCase):
    def fixture(self, directory, *, duplicate=False, symlink=False, extra=False):
        archive = pathlib.Path(directory)/'synthetic.zip'
        blobs = {n: b'{}' for n in ('train.json', 'validation.json', 'collection-summary.json', 'audit.sealed.json')}
        blobs['final.sealed.json'] = b'{"opaque":"development-ciphertext"}'
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as z:
                for name, data in blobs.items():
                    info = zipfile.ZipInfo(name)
                    if symlink and name == 'final.sealed.json':
                        info.external_attr = (stat.S_IFLNK | 0o777) << 16
                    z.writestr(info, data)
                if duplicate:
                    z.writestr('train.json', b'{}')
                if extra:
                    z.writestr('../outside.json', b'{}')
        receipt = {'digest': 'sha256:'+hashlib.sha256(archive.read_bytes()).hexdigest(),
                   'finalCiphertextSha256': hashlib.sha256(blobs['final.sealed.json']).hexdigest()}
        return archive, receipt

    def test_only_summary_and_ciphertext_are_exported(self):
        with tempfile.TemporaryDirectory() as t:
            archive, receipt = self.fixture(t)
            destination = pathlib.Path(t)/'out'
            result = unzip.extract(archive, destination, receipt)
            self.assertFalse(result['finalOpened'])
            self.assertFalse(result['plainFinalExported'])
            self.assertEqual(set(p.name for p in destination.iterdir()), {'collection-summary.json', 'final.sealed.json'})
            with self.assertRaises(ValueError):
                unzip.extract(archive, destination, receipt)

    def test_changed_zip_or_ciphertext_is_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            archive, receipt = self.fixture(t)
            for key in receipt:
                changed = {**receipt, key: ('sha256:' if key == 'digest' else '')+'0'*64}
                with self.assertRaises(ValueError):
                    unzip.extract(archive, pathlib.Path(t)/'out', changed)

    def test_duplicates_symlink_and_path_escape_are_rejected(self):
        for option in ('duplicate', 'symlink', 'extra'):
            with tempfile.TemporaryDirectory() as t:
                archive, receipt = self.fixture(t, **{option: True})
                with self.assertRaises(ValueError):
                    unzip.extract(archive, pathlib.Path(t)/'out', receipt)

    def test_crc_damage_is_rejected_even_when_zip_digest_is_updated(self):
        with tempfile.TemporaryDirectory() as t:
            archive, receipt = self.fixture(t)
            damaged = archive.read_bytes().replace(b'development-ciphertext', b'Development-ciphertext', 1)
            archive.write_bytes(damaged)
            receipt['digest'] = 'sha256:'+hashlib.sha256(damaged).hexdigest()
            with self.assertRaises(zipfile.BadZipFile):
                unzip.extract(archive, pathlib.Path(t)/'out', receipt)


if __name__ == '__main__':
    unittest.main()
