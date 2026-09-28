from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
out = root / 'dist'
out.mkdir(exist_ok=True)
with ZipFile(out / 'maeum-focus-1.0.0.zip', 'w', ZIP_DEFLATED) as archive:
    for pattern in ['manifest.json', '*.html', 'style.css', 'src/*.js', 'assets/*', 'README.md', 'PRIVACY.md']:
        for file in root.glob(pattern):
            archive.write(file, file.relative_to(root))
print(out / 'maeum-focus-1.0.0.zip')
