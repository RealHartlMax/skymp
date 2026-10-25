"""Validate the delivered Linux ZIPs using Python's independent ZIP reader."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--release', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--report', required=True)
args = parser.parse_args()
release, output = Path(args.release), Path(args.output)
assert not output.exists(), 'Extraction directory must be new'
description = json.loads((release / 'distributions.json').read_text())
assert description['platform'] == 'linux-x64'
protected = {'server-settings.json', 'logo.png', 'banner.png', 'data', 'world', 'client-resources', 'plugins', 'mods', 'gamemode.js', 'package.json', 'package-lock.json', '.runtime', '.env', 'logs'}
reports = []
for artifact in description['artifacts']:
    archive = release / artifact['file']
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == artifact['sha256']
    target = output / artifact['mode']
    expected = {item['path']: item for item in artifact['files']}
    seen = set()
    with zipfile.ZipFile(archive) as package:
        assert package.testzip() is None
        for info in package.infolist():
            name = PurePosixPath(info.filename)
            assert not name.is_absolute() and '..' not in name.parts and '\\' not in info.filename
            assert info.create_system == 3, 'Linux ZIP must declare Unix file modes'
            mode = info.external_attr >> 16
            assert stat.S_ISDIR(mode) if info.is_dir() else stat.S_ISREG(mode)
            expected_mode = 0o755 if info.is_dir() or info.filename.endswith('.sh') or info.filename == 'scam_native.node' else 0o644
            assert stat.S_IMODE(mode) == expected_mode, info.filename
            if artifact['mode'] == 'update':
                assert name.parts[0] not in protected, info.filename
            if not info.is_dir():
                assert info.filename in expected and info.filename not in seen
                content = package.read(info)
                assert len(content) == expected[info.filename]['bytes']
                assert hashlib.sha256(content).hexdigest() == expected[info.filename]['sha256']
                seen.add(info.filename)
            package.extract(info, target)
            os.chmod(target / info.filename, stat.S_IMODE(mode))
        assert seen == set(expected)
    manifest = json.loads((target / 'build-manifest.json').read_text())
    assert manifest['distributionMode'] == artifact['mode']
    assert manifest['requiresExistingInstallation'] == (artifact['mode'] == 'update')
    for item in manifest['files']:
        assert hashlib.sha256((target / item['path']).read_bytes()).hexdigest() == item['sha256']
    assert os.access(target / 'start-test-server.sh', os.X_OK)
    if artifact['mode'] == 'full':
        assert (target / 'server-settings.json').is_file()
        assert (target / 'data/scripts').is_dir()
        assert not (target / 'data/admin-auth.json').exists()
    reports.append({'mode': artifact['mode'], 'file': artifact['file'], 'files': len(seen), 'sha256': artifact['sha256']})
assert {item['mode'] for item in reports} == {'full', 'update'}
result = {'ok': True, 'archives': reports, 'linuxExecutableModesValidated': True, 'updateProtectedPathsExcluded': True, 'independentZipReader': 'python.zipfile'}
Path(args.report).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
