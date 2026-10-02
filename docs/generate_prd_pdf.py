from pathlib import Path
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, PageBreak

base = Path(__file__).resolve().parent
src = base / 'PRD.md'
out = base / 'PRD.pdf'

if not src.exists():
    raise FileNotFoundError(f'Missing source file: {src}')

text = src.read_text(encoding='utf-8')
lines = text.splitlines()

# Convert the markdown PRD into simple paragraphs and headings.
paragraphs = []
current = []

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleStyle', parent=styles['Title'], fontSize=20, leading=22, spaceAfter=18, textColor='#111827'))
styles.add(ParagraphStyle(name='SectionStyle', parent=styles['Heading2'], fontSize=14, leading=18, spaceBefore=10, textColor='#1f2937', fontName='Helvetica-Bold'))
styles.add(ParagraphStyle(name='BodyStyle', parent=styles['BodyText'], fontSize=10, leading=14, spaceAfter=6, textColor='#222222'))
styles.add(ParagraphStyle(name='BulletStyle', parent=styles['BodyText'], fontSize=10, leading=14, leftIndent=16, bulletIndent=10, spaceAfter=4, textColor='#222222'))

for raw in lines:
    line = raw.rstrip()
    if not line.strip():
        if current:
            paragraphs.append(('para', ' '.join(current).strip()))
            current = []
        continue

    if line.startswith('# '):
        if current:
            paragraphs.append(('para', ' '.join(current).strip()))
            current = []
        paragraphs.append(('title', line[2:].strip()))
    elif line.startswith('## '):
        if current:
            paragraphs.append(('para', ' '.join(current).strip()))
            current = []
        paragraphs.append(('section', line[3:].strip()))
    elif line.startswith('- '):
        if current:
            paragraphs.append(('para', ' '.join(current).strip()))
            current = []
        paragraphs.append(('bullet', line[2:].strip()))
    elif line.startswith('1. ') or line.startswith('2. ') or line.startswith('3. '):
        if current:
            paragraphs.append(('para', ' '.join(current).strip()))
            current = []
        paragraphs.append(('bullet', line.split('. ', 1)[1].strip()))
    else:
        current.append(line.strip())

if current:
    paragraphs.append(('para', ' '.join(current).strip()))

# Build PDF flowables.
flow = []
for kind, value in paragraphs:
    if kind == 'title':
        flow.append(Paragraph(value, styles['TitleStyle']))
    elif kind == 'section':
        flow.append(Paragraph(value, styles['SectionStyle']))
    elif kind == 'bullet':
        flow.append(Paragraph(f'• {value}', styles['BulletStyle']))
    else:
        flow.append(Paragraph(value, styles['BodyStyle']))
    flow.append(Spacer(1, 6))

# Use a slightly larger page and keep consistent margins.
doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=0.8 * inch, rightMargin=0.8 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch)
doc.build(flow)
print(f'PDF created: {out}')
