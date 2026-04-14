import hashlib
import json
import os
import sys

import win32con
import win32print
import win32ui
from PIL import Image, ImageDraw, ImageFont, ImageWin


def load_payload(payload_path):
    with open(payload_path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def load_font(size, bold=False):
    font_candidates = [
        'arialbd.ttf' if bold else 'arial.ttf',
        'segoeuib.ttf' if bold else 'segoeui.ttf',
        'consolab.ttf' if bold else 'consola.ttf',
    ]

    for candidate in font_candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue

    return ImageFont.load_default()


def wrap_text(draw, text, font, max_width):
    clean_text = ' '.join(str(text or '').split())
    if not clean_text:
        return []

    words = clean_text.split(' ')
    lines = []
    current = ''

    for word in words:
        candidate = word if not current else f'{current} {word}'
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines


def draw_wrapped_text(draw, x, y, text, font, max_width, fill='black', align='left', line_gap=4):
    lines = wrap_text(draw, text, font, max_width)
    if not lines:
        return y

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        line_height = bbox[3] - bbox[1]

        if align == 'center':
            draw_x = x + ((max_width - line_width) // 2)
        elif align == 'right':
            draw_x = x + max_width - line_width
        else:
            draw_x = x

        draw.text((draw_x, y), line, fill=fill, font=font)
        y += line_height + line_gap

    return y


def build_stamp_seed(receipt, dte):
    source = dte.get('ted') or dte.get('xml') or receipt.get('preview') or json.dumps(receipt, ensure_ascii=False)
    return hashlib.sha256(str(source).encode('utf-8')).digest()


def draw_fake_pdf417(draw, left, top, width, height, seed):
    draw.rectangle([left, top, left + width, top + height], outline='black', width=2)

    inner_left = left + 6
    inner_top = top + 6
    inner_width = max(10, width - 12)
    inner_height = max(10, height - 12)

    cols = 34
    rows = 12
    cell_w = max(2, inner_width // cols)
    cell_h = max(3, inner_height // rows)

    for row in range(rows):
        for col in range(cols):
            idx = (row * cols + col) % len(seed)
            bitmask = 1 << (col % 8)
            is_dark = (seed[idx] & bitmask) != 0

            if is_dark:
                x0 = inner_left + col * cell_w
                y0 = inner_top + row * cell_h
                x1 = x0 + cell_w - 1
                y1 = y0 + cell_h - 1
                draw.rectangle([x0, y0, x1, y1], fill='black')


def build_receipt_image(payload):
    receipt = payload.get('receipt') or {}
    emisor = receipt.get('emisor') or {}
    dte = receipt.get('dte') or {}
    printer_paper = str(payload.get('printerPaper') or '80mm').strip().lower()
    logo_path = payload.get('logoPath')
    width_px = 464 if printer_paper == '58mm' else 640
    is_small_paper = printer_paper == '58mm'
    padding = 18 if is_small_paper else 24
    gap = 8 if is_small_paper else 10

    font_brand = load_font(34 if is_small_paper else 36, bold=True)
    font_title = load_font(25 if is_small_paper else 27, bold=True)
    font_body = load_font(19 if is_small_paper else 21, bold=False)
    font_body_bold = load_font(20 if is_small_paper else 22, bold=True)
    font_small = load_font(16 if is_small_paper else 18, bold=False)
    font_small_bold = load_font(17 if is_small_paper else 19, bold=True)
    font_mono = load_font(18 if is_small_paper else 20, bold=True)
    font_box_rut = load_font(21 if is_small_paper else 23, bold=True)
    font_box_doc = load_font(19 if is_small_paper else 21, bold=True)

    document_type = str(receipt.get('documentType') or 'Documento')
    tipo_dte = dte.get('tipo')
    folio = dte.get('folio')
    is_fiscal = bool(tipo_dte and folio)
    origin = str(receipt.get('origin') or 'sale').strip().lower()
    is_dispatch_origin = origin == 'dispatch'

    image = Image.new('RGB', (width_px, 4200), 'white')
    draw = ImageDraw.Draw(image)
    cursor_y = padding
    content_width = width_px - (padding * 2)

    if logo_path and os.path.exists(logo_path) and not is_fiscal:
        try:
            logo = Image.open(logo_path).convert('RGBA')
            logo.thumbnail((int(width_px * 0.48), 110 if is_small_paper else 130))
            logo_x = (width_px - logo.width) // 2
            image.paste(logo, (logo_x, cursor_y), logo)
            cursor_y += logo.height + gap
        except OSError:
            pass

    if is_fiscal:
        brand = str(emisor.get('razonSocial') or 'VALMU').upper()
        brand_box = draw.textbbox((0, 0), brand, font=font_brand)
        brand_width = brand_box[2] - brand_box[0]
        draw.text(((width_px - brand_width) // 2, cursor_y), brand, fill='black', font=font_brand)
        cursor_y += (brand_box[3] - brand_box[1]) + 10

        for text in [
            f"Giro: {emisor.get('giro') or ''}",
            f"{emisor.get('direccion') or ''}",
            f"{emisor.get('comuna') or ''}, {emisor.get('ciudad') or ''}"
        ]:
            cursor_y = draw_wrapped_text(
                draw,
                padding,
                cursor_y,
                text,
                font_small,
                content_width,
                align='center',
                line_gap=2
            )

        cursor_y += 8
        box_h = 132 if is_small_paper else 144
        box_w = min(content_width, 360 if is_small_paper else 420)
        box_x = (width_px - box_w) // 2
        draw.rectangle([box_x, cursor_y, box_x + box_w, cursor_y + box_h], outline='black', width=2)

        box_lines = [
            (f"R.U.T.: {emisor.get('rut') or ''}", font_box_rut),
            ('FACTURA ELECTRONICA' if tipo_dte == 33 else 'BOLETA ELECTRONICA', font_box_doc),
            (f"N° {folio}", font_box_rut),
            (f"S.I.I. - {emisor.get('ciudad') or 'CHILE'}", font_box_doc)
        ]

        box_cursor = cursor_y + 8
        for text, font in box_lines:
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            draw.text((box_x + ((box_w - text_w) // 2), box_cursor), text, fill='black', font=font)
            box_cursor += text_h + 4

        cursor_y += box_h + 14
    else:
        title = 'VALMU CAJERO'
        title_box = draw.textbbox((0, 0), title, font=font_brand)
        title_width = title_box[2] - title_box[0]
        draw.text(((width_px - title_width) // 2, cursor_y), title, fill='black', font=font_brand)
        cursor_y += (title_box[3] - title_box[1]) + 8

        header_title = 'VALE DE DESPACHO' if 'despacho' in document_type.lower() else document_type.upper()
        header_box = draw.textbbox((0, 0), header_title, font=font_title)
        header_width = header_box[2] - header_box[0]
        draw.text(((width_px - header_width) // 2, cursor_y), header_title, fill='black', font=font_title)
        cursor_y += (header_box[3] - header_box[1]) + 8

    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap

    meta_lines = [f"Fecha: {receipt.get('dateLabel') or ''}"]

    reference_label = str(receipt.get('referenceLabel') or '').strip()
    if reference_label and not (is_fiscal and is_dispatch_origin):
        meta_lines.insert(0, reference_label)

    customer_label = str(receipt.get('customerLabel') or 'General').strip()
    payment_label = str(receipt.get('paymentMethod') or 'Efectivo').strip()
    if customer_label:
        meta_lines.append(f"Cliente: {customer_label}")
    if payment_label:
        meta_lines.append(f"Pago: {payment_label}")

    sale_id = receipt.get('saleId')
    if sale_id and not reference_label and not str(sale_id).startswith('C-') and not (is_fiscal and is_dispatch_origin):
        meta_lines.insert(0, f"Venta #: {sale_id}")

    for line in meta_lines:
        draw.text((padding, cursor_y), line, fill='black', font=font_body_bold)
        bbox = draw.textbbox((padding, cursor_y), line, font=font_body_bold)
        cursor_y += (bbox[3] - bbox[1]) + 6

    cursor_y += 4
    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap

    detail_title = 'DETALLE DE PRODUCTOS'
    draw.text((padding, cursor_y), detail_title, fill='black', font=font_title)
    detail_title_box = draw.textbbox((padding, cursor_y), detail_title, font=font_title)
    cursor_y += (detail_title_box[3] - detail_title_box[1]) + 10

    detail_lines = receipt.get('lineItems') or []
    if detail_lines:
        for item in detail_lines:
            name = str(item.get('name') or 'Producto').upper()
            qty = str(item.get('quantityLabel') or '1')
            unit_price = f"${item.get('unitPrice', 0):,}".replace(',', '.')
            subtotal = f"${item.get('subtotal', 0):,}".replace(',', '.')

            cursor_y = draw_wrapped_text(
                draw,
                padding,
                cursor_y,
                name,
                font_body_bold,
                content_width,
                line_gap=2
            )

            row_text = f"{qty} x {unit_price}"
            draw.text((padding, cursor_y), row_text, fill='black', font=font_body)
            subtotal_box = draw.textbbox((0, 0), subtotal, font=font_mono)
            subtotal_w = subtotal_box[2] - subtotal_box[0]
            subtotal_h = subtotal_box[3] - subtotal_box[1]
            draw.text((width_px - padding - subtotal_w, cursor_y), subtotal, fill='black', font=font_mono)
            cursor_y += max(subtotal_h, 22) + 10
    else:
        preview_lines = str(receipt.get('preview') or '').splitlines()
        for preview_line in preview_lines:
            if not preview_line:
                cursor_y += 10
                continue
            cursor_y = draw_wrapped_text(
                draw,
                padding,
                cursor_y,
                preview_line,
                font_body,
                content_width,
                line_gap=2
            )
            cursor_y += 2

    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap

    totals = [
        ('SUBTOTAL', f"${receipt.get('subtotal', 0):,}".replace(',', '.')),
        ('IVA (19%)', f"${receipt.get('iva', 0):,}".replace(',', '.')),
        ('TOTAL', f"${receipt.get('total', 0):,}".replace(',', '.')),
    ]

    for label, value in totals:
        label_font = font_title if label == 'TOTAL' else font_body_bold
        value_font = font_title if label == 'TOTAL' else font_mono
        draw.text((padding, cursor_y), label, fill='black', font=label_font)
        value_box = draw.textbbox((0, 0), value, font=value_font)
        value_w = value_box[2] - value_box[0]
        value_h = value_box[3] - value_box[1]
        draw.text((width_px - padding - value_w, cursor_y), value, fill='black', font=value_font)
        cursor_y += max(value_h, 24) + 8

    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap + 2

    footer = str(receipt.get('footerMessage') or '').strip()
    if not footer:
        footer = 'GRACIAS POR SU COMPRA'

    if is_fiscal:
        stamp_title = 'TIMBRE ELECTRONICO SII'
        draw.text((padding, cursor_y), stamp_title, fill='black', font=font_small_bold)
        stamp_title_box = draw.textbbox((padding, cursor_y), stamp_title, font=font_small_bold)
        cursor_y += (stamp_title_box[3] - stamp_title_box[1]) + 6

        stamp_height = 92 if is_small_paper else 108
        draw_fake_pdf417(draw, padding, cursor_y, content_width, stamp_height, build_stamp_seed(receipt, dte))
        cursor_y += stamp_height + 8

        resolution = f"Resolucion SII N° {emisor.get('resolucionNumero') or 80} del {emisor.get('resolucionFecha') or '2014-08-22'}"
        cursor_y = draw_wrapped_text(
            draw,
            padding,
            cursor_y,
            resolution,
            font_small,
            content_width,
            align='center',
            line_gap=2
        )
        cursor_y += 4

    cursor_y = draw_wrapped_text(
        draw,
        padding,
        cursor_y,
        footer,
        font_small_bold if is_fiscal else font_body_bold,
        content_width,
        align='center',
        line_gap=3
    )
    cursor_y += padding

    final_image = image.crop((0, 0, width_px, cursor_y))
    final_image = final_image.convert('L')
    final_image = final_image.point(lambda pixel: 0 if pixel < 190 else 255, mode='1')
    return final_image


def print_image(printer_name, image):
    hdc = win32ui.CreateDC()
    hdc.CreatePrinterDC(printer_name)
    printable_width = hdc.GetDeviceCaps(win32con.HORZRES)
    printable_height = hdc.GetDeviceCaps(win32con.VERTRES)

    scale_ratio = printable_width / image.width
    scaled_height = int(image.height * scale_ratio)
    if scaled_height > printable_height:
        scaled_height = printable_height

    resized_image = image.resize((printable_width, scaled_height), Image.Resampling.NEAREST)
    dib = ImageWin.Dib(resized_image)

    hdc.StartDoc('Valmu Cajero Receipt')
    hdc.StartPage()
    dib.draw(hdc.GetHandleOutput(), (0, 0, printable_width, scaled_height))
    hdc.EndPage()
    hdc.EndDoc()
    hdc.DeleteDC()


def main():
    payload_path = sys.argv[1] if len(sys.argv) > 1 else ''
    if not payload_path or not os.path.exists(payload_path):
        print(json.dumps({'ok': False, 'error': 'No se encontro el payload de impresion.'}))
        return 1

    payload = load_payload(payload_path)
    printer_name = str(payload.get('printerName') or '').strip()
    if not printer_name or printer_name == 'Predeterminada del sistema':
        printer_name = win32print.GetDefaultPrinter()

    if not printer_name:
        print(json.dumps({'ok': False, 'error': 'No hay una impresora configurada.'}))
        return 1

    try:
        image = build_receipt_image(payload)
        print_image(printer_name, image)
        print(json.dumps({'ok': True, 'printerName': printer_name}))
        return 0
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
