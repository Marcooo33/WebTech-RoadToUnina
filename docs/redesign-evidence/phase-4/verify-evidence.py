"""Reconcile stored evidence; this does not rerun browser/build/E2E checks."""
from pathlib import Path
import hashlib
import json
import re

base = Path(__file__).resolve().parent

def read(name):
    return json.loads((base / name).read_text())

checks = read('checks.json')
assert len(checks) == 130
layout = [row for row in checks if 'scrollWidth' in row]
assert len(layout) == 126
assert all(row['scrollWidth'] <= row['width'] for row in layout)
assert all(row['open'] for row in checks if row not in layout)
for name in ('error-reading-final.json', 'error-edge-final.json'):
    rows = read(name)
    assert len(rows) == 10
    for row in rows:
        assert row['announcements'] == 1 and row['insideHud']
        assert row['intersectionViewport'] >= row['notice']['height'] - 1
        assert row['contrast'] >= 4.5 and row['pageWidth'] <= row['width']
        if row['width'] < 1120:
            assert row['active']['rect']['top'] >= row['hud']['bottom']
growth = read('focus-growth-final.json')
assert len(growth) == 10
assert all(row['after']['same'] for row in growth)
assert all(row['shrink']['calls'] == len(row['after']['calls']) for row in growth)
comparison = read('screenshot-comparison.json')
assert not comparison['missing']
assert len(comparison['unchanged']) == 128 and len(comparison['changed']) == 4
assert len(comparison['added']) == 30
for name, digest in comparison['sha256'].items():
    assert hashlib.sha256((base / name).read_bytes()).hexdigest() == digest, name
assert re.search(r'Tests\s+79 passed', (base / 'unit.txt').read_text())
assert '22 passed' in (base / 'e2e.txt').read_text()
assert 'Output location:' in (base / 'build.txt').read_text()
print('PASS: 130 layout records, 20 error cases, 10 focus cases, 162 image hashes, final logs')
