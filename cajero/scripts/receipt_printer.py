import json
import os
import sys

import win32con
import win32print
import win32ui
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageWin, ImageFilter


def load_payload(payload_path):
    with open(payload_path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def load_font(size, bold=False):
    font_candidates = [
        'arialbd.ttf' if bold else 'arial.ttf',
        'segoeuib.ttf' if bold else 'segoeui.ttf',
    ]

    for candidate in font_candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue

    return ImageFont.load_default()


def mm_to_px(mm_value):
    return int((mm_value / 25.4) * 203)


def build_receipt_image(payload):
    receipt = payload.get('receipt') or {}
    printer_paper = str(payload.get('printerPaper') or '80mm').strip().lower()
    logo_path = payload.get('logoPath')
    width_px = 464 if printer_paper == '58mm' else 640
    is_small_paper = printer_paper == '58mm'
    padding = 18 if is_small_paper else 22
    gap = 8 if is_small_paper else 10

    font_title = load_font(42 if is_small_paper else 38, bold=True)
    font_subtitle = load_font(26 if is_small_paper else 24, bold=True)
    font_body = load_font(25 if is_small_paper else 23, bold=True)
    font_small = load_font(22 if is_small_paper else 19, bold=False)
    font_mono = load_font(21 if is_small_paper else 18, bold=True)

    document_type = str(receipt.get('documentType') or 'Comprobante')
    is_dispatch = 'despacho' in document_type.lower()
    is_internal = 'interno' in document_type.lower()
    header_title = (
        'VALE DE DESPACHO'
        if is_dispatch
        else 'COMPROBANTE INTERNO'
        if is_internal
        else 'BOLETA REFERENCIAL'
    )

    header_lines = [
        header_title,
        f"Nro {receipt.get('saleId', '')}",
        document_type
    ]
    meta_lines = [
        f"Fecha: {receipt.get('dateLabel') or ''}",
        f"Cliente: {receipt.get('customerLabel') or 'General'}",
        f"Pago: {receipt.get('paymentMethod') or 'Efectivo'}"
    ]
    detail_lines = receipt.get('lineItems') or []
    preview_lines = str(receipt.get('preview') or '').splitlines()

    image = Image.new('RGB', (width_px, 2000), 'white')
    draw = ImageDraw.Draw(image)
    cursor_y = padding

    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert('RGBA')
            logo.thumbnail((int(width_px * 0.62), 150 if is_small_paper else 140))
            logo_x = (width_px - logo.width) // 2
            image.paste(logo, (logo_x, cursor_y), logo)
            cursor_y += logo.height + gap
        except OSError:
            pass

    title = 'Valmu Cajero'
    title_box = draw.textbbox((0, 0), title, font=font_title)
    draw.text(((width_px - (title_box[2] - title_box[0])) // 2, cursor_y), title, fill='black', font=font_title)
    cursor_y += (title_box[3] - title_box[1]) + 6

    for line in header_lines:
        header_box = draw.textbbox((0, 0), line, font=font_subtitle)
        draw.text(((width_px - (header_box[2] - header_box[0])) // 2, cursor_y), line, fill='black', font=font_subtitle)
        cursor_y += (header_box[3] - header_box[1]) + 4

    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap

    for line in meta_lines:
        draw.text((padding, cursor_y), line, fill='black', font=font_body)
        text_box = draw.textbbox((padding, cursor_y), line, font=font_body)
        cursor_y += (text_box[3] - text_box[1]) + 6

    cursor_y += 2
    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap

    draw.text((padding, cursor_y), 'DETALLE', fill='black', font=font_subtitle)
    cursor_y += 32

    if detail_lines:
        for item in detail_lines:
            name = str(item.get('name') or 'Producto')
            qty = str(item.get('quantityLabel') or '1')
            unit_price = f"${item.get('unitPrice', 0)}"
            subtotal = f"${item.get('subtotal', 0)}"

            draw.multiline_text((padding, cursor_y), name, fill='black', font=font_body, spacing=2)
            name_box = draw.multiline_textbbox((padding, cursor_y), name, font=font_body, spacing=2)
            cursor_y += (name_box[3] - name_box[1]) + 4

            detail_row = f"{qty} x {unit_price}"
            draw.text((padding, cursor_y), detail_row, fill='black', font=font_small)
            subtotal_box = draw.textbbox((0, 0), subtotal, font=font_mono)
            draw.text((width_px - padding - (subtotal_box[2] - subtotal_box[0]), cursor_y), subtotal, fill='black', font=font_mono)
            cursor_y += max(subtotal_box[3] - subtotal_box[1], 22) + 8
    else:
        for preview_line in preview_lines:
            if not preview_line:
                cursor_y += 10
                continue
            draw.multiline_text((padding, cursor_y), preview_line, fill='black', font=font_small, spacing=2)
            text_box = draw.multiline_textbbox((padding, cursor_y), preview_line, font=font_small, spacing=2)
            cursor_y += (text_box[3] - text_box[1]) + 8

    cursor_y += 8
    draw.line((padding, cursor_y, width_px - padding, cursor_y), fill='black', width=2)
    cursor_y += gap

    totals = [
        ('SUBTOTAL', f"${receipt.get('subtotal', 0)}"),
        ('IVA', f"${receipt.get('iva', 0)}"),
        ('TOTAL', f"${receipt.get('total', 0)}"),
    ]

    for label, value in totals:
        label_font = font_subtitle if label == 'TOTAL' else font_body
        value_font = font_subtitle if label == 'TOTAL' else font_mono
        draw.text((padding, cursor_y), label, fill='black', font=label_font)
        value_box = draw.textbbox((0, 0), value, font=value_font)
        draw.text((width_px - padding - (value_box[2] - value_box[0]), cursor_y), value, fill='black', font=value_font)
        cursor_y += max(value_box[3] - value_box[1], 24) + 6

    cursor_y += 4
    footer = 'Revise su carga' if is_dispatch else 'Gracias por su compra'
    footer_box = draw.textbbox((0, 0), footer, font=font_small)
    draw.text(((width_px - (footer_box[2] - footer_box[0])) // 2, cursor_y), footer, fill='black', font=font_small)
    cursor_y += (footer_box[3] - footer_box[1]) + 4

    legal_copy = (
        'Vale de despacho referencial. La rendicion se revisa con administracion.'
        if is_dispatch
        else 'Documento referencial. Integracion fiscal pendiente.'
    )
    legal_box = draw.multiline_textbbox((padding, cursor_y), legal_copy, font=font_small, spacing=2)
    draw.multiline_text((padding, cursor_y), legal_copy, fill='black', font=font_small, spacing=2, align='center')
    cursor_y += (legal_box[3] - legal_box[1]) + padding

    final_image = image.crop((0, 0, width_px, cursor_y))
    final_image = ImageOps.expand(final_image, border=0, fill='white')
    final_image = final_image.convert('L')
    final_image = final_image.filter(ImageFilter.SHARPEN)
    final_image = final_image.point(lambda pixel: 0 if pixel < 185 else 255, mode='1')
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
