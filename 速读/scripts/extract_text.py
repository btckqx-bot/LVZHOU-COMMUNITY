#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""速读 · 文档文本提取器
优先读取 PDF 自带文本层（pypdf），扫描件/无文本层时回退 OCR。
用法:
  python extract_text.py <input> <output.txt> [--dpi 200] [--lang chi_sim+eng]
支持: .pdf .docx .doc .txt .md .epub
"""
import sys, argparse, os

def from_pdf(path, dpi=200, lang='chi_sim+eng'):
    from pypdf import PdfReader
    reader = PdfReader(path)
    pages = []
    for i, page in enumerate(reader.pages, 1):
        try:
            txt = page.extract_text() or ''
        except Exception:
            txt = ''
        pages.append(f"===== PAGE {i} =====\n{txt}")
    full = "\n".join(pages)
    # 文本层过薄 -> OCR 回退
    if len(full.strip()) < 200 * max(1, len(reader.pages)) * 0.05:
        return from_pdf_ocr(path, dpi, lang)
    return full

def from_pdf_ocr(path, dpi, lang):
    import fitz
    import pytesseract
    from PIL import Image
    import io
    doc = fitz.open(path)
    pages = []
    for i, page in enumerate(doc, 1):
        pix = page.get_pixmap(dpi=dpi)
        img = Image.open(io.BytesIO(pix.tobytes('png')))
        txt = pytesseract.image_to_string(img, lang=lang)
        pages.append(f"===== PAGE {i} =====\n{txt}")
    return "\n".join(pages)

def from_docx(path):
    from docx import Document
    d = Document(path)
    lines = []
    for i, p in enumerate(d.paragraphs, 1):
        if p.text.strip():
            lines.append(f"===== PARA {i} [{p.style.name}] =====\n{p.text}")
    for ti, table in enumerate(d.tables, 1):
        lines.append(f"===== TABLE {ti} =====")
        for row in table.rows:
            lines.append(" | ".join(c.text for c in row.cells))
    return "\n".join(lines)

def from_txt(path):
    for enc in ('utf-8', 'utf-8-sig', 'gbk', 'gb18030'):
        try:
            with open(path, encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise RuntimeError('无法识别文本编码')

def from_epub(path):
    from ebooklib import epub
    from bs4 import BeautifulSoup
    book = epub.read_epub(path)
    out = []
    for i, item in enumerate(book.get_items(), 1):
        if item.get_type() == 9:  # ITEM_DOCUMENT
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            out.append(f"===== CH {i} =====\n{soup.get_text('\n')}")
    return "\n".join(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input'); ap.add_argument('output')
    ap.add_argument('--dpi', type=int, default=200)
    ap.add_argument('--lang', default='chi_sim+eng')
    a = ap.parse_args()
    ext = os.path.splitext(a.input)[1].lower()
    if ext == '.doc':
        raise SystemExit(
            '旧版 .doc（OLE2）无法用 python-docx 读取。请先用 LibreOffice/Word 转为 .docx 后重试：\n'
            '  soffice --headless --convert-to docx "<输入.doc>" --outdir <目录>\n'
            '或从任务起点就提供 .docx / .pdf / .txt / .md / .epub。'
        )
    handlers = {'.pdf': lambda: from_pdf(a.input, a.dpi, a.lang),
                '.docx': lambda: from_docx(a.input),
                '.txt': lambda: from_txt(a.input),
                '.md': lambda: from_txt(a.input),
                '.epub': lambda: from_epub(a.input)}
    if ext not in handlers:
        raise SystemExit(f'不支持的格式: {ext}')
    text = handlers[ext]()
    with open(a.output, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'OK {a.output} chars={len(text)}')
    # 依赖缺失提示
    if ext == '.pdf' and len(text) < 500:
        print('WARN: 文本层疑似缺失，建议使用 OCR: pip install pymupdf pytesseract pillow')

if __name__ == '__main__':
    main()
