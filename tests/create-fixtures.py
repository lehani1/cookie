from pathlib import Path
from zipfile import ZipFile
root=Path(__file__).parent/'fixtures'
objects=[b'<< /Type /Catalog /Pages 2 0 R /Outlines 8 0 R >>',b'<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>']
for n in [1,2]:
    stream=f'BT /F1 24 Tf 72 700 Td (Folio test page {n}) Tj ET'.encode()
    objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
    if n==1: objects.append(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>')
objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
objects.extend([b'<< /Type /Outlines /First 9 0 R /Last 9 0 R /Count 2 >>', b'<< /Title (First chapter) /Parent 8 0 R /Dest [3 0 R /Fit] /First 10 0 R /Last 10 0 R /Count 1 >>', b'<< /Title (Second chapter) /Parent 9 0 R /Dest [5 0 R /Fit] >>'])
pdf=b'%PDF-1.4\n';offsets=[]
for i,o in enumerate(objects):
    offsets.append(len(pdf));pdf+=f'{i+1} 0 obj\n'.encode()+o+b'\nendobj\n'
xref=len(pdf);pdf+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
for offset in offsets:pdf+=f'{offset:010d} 00000 n \n'.encode()
pdf+=f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
(root/'Reading sample.pdf').write_bytes(pdf)
with ZipFile(root/'Reading sample.epub','w') as z:
    z.writestr('mimetype','application/epub+zip')
    z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">folio-test</dc:identifier><dc:title>Reading sample</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>')
    z.writestr('chapter.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A quiet chapter</title></head><body><h1>A quiet chapter</h1><p>This EPUB is ready to read in Folio.</p>'+''.join(f'<p>Quiet reading paragraph {i}. A long chapter should scroll naturally while keeping notes attached to the selected passage.</p>' for i in range(60))+'</body></html>')
    z.writestr('nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">A quiet chapter</a></li></ol></nav></body></html>')
