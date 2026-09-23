"""
Generates the demo PDFs in public/samples/ from the values in lib/samples.ts.
Run: python scripts/make_samples.py   (needs: pip install reportlab)
All companies, people and addresses are fictional.
"""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "samples")
os.makedirs(OUT, exist_ok=True)
INK = HexColor("#1d2429")
MUTED = HexColor("#5b6670")
RULE = HexColor("#c9cfd3")
W, H = letter


def money(n):
    return f"${n:,.2f}"


def header(c, vendor, addr, doc_title, accent):
    c.setFillColor(HexColor(accent))
    c.rect(0, H - 14, W, 14, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(50, H - 62, vendor)
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    for i, line in enumerate(addr):
        c.drawString(50, H - 78 - i * 12, line)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 20)
    c.drawRightString(W - 50, H - 62, doc_title)


def kv_block(c, x, y, pairs, label_w=95):
    for i, (k, v) in enumerate(pairs):
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        c.drawString(x, y - i * 14, k)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(INK)
        c.drawString(x + label_w, y - i * 14, v)


def bill_to(c, y):
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawString(50, y, "BILL TO")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y - 14, "Northgate Electric & Controls")
    c.setFont("Helvetica", 9)
    c.drawString(50, y - 27, "Accounts Payable")
    c.drawString(50, y - 39, "4410 Industrial Pkwy, Sacramento, CA 95834")


def table(c, y, cols, rows, widths, aligns):
    x0 = 50
    c.setStrokeColor(RULE)
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(MUTED)
    x = x0
    for col, w, a in zip(cols, widths, aligns):
        if a == "r":
            c.drawRightString(x + w - 4, y, col)
        else:
            c.drawString(x + 4, y, col)
        x += w
    c.line(x0, y - 5, x0 + sum(widths), y - 5)
    y -= 20
    c.setFillColor(INK)
    c.setFont("Helvetica", 9)
    for r in rows:
        x = x0
        for cell, w, a in zip(r, widths, aligns):
            if a == "r":
                c.drawRightString(x + w - 4, y, cell)
            else:
                c.drawString(x + 4, y, cell)
            x += w
        c.line(x0, y - 6, x0 + sum(widths), y - 6)
        y -= 20
    return y


def totals(c, y, pairs):
    for i, (k, v, bold) in enumerate(pairs):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 10 if bold else 9)
        c.setFillColor(INK if bold else MUTED)
        c.drawRightString(W - 150, y - i * 16, k)
        c.setFillColor(INK)
        c.drawRightString(W - 54, y - i * 16, v)


def footer(c, text):
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(50, 50, text)


def invoice(path, vendor, addr, accent, meta, items, subtotal, tax_label, tax, total, terms):
    c = canvas.Canvas(path, pagesize=letter)
    header(c, vendor, addr, "INVOICE", accent)
    kv_block(c, W - 280, H - 110, meta, label_w=80)
    bill_to(c, H - 120)
    rows = [[d, f"{q:g}", u, money(p), money(a)] for d, q, u, p, a in items]
    y = table(c, H - 230, ["Description", "Qty", "Unit", "Unit price", "Amount"], rows,
              [260, 50, 45, 76, 81], ["l", "r", "l", "r", "r"])
    totals(c, y - 14, [("Subtotal", money(subtotal), False), (tax_label, money(tax), False), ("Total due", money(total), True)])
    footer(c, terms)
    c.save()


# 1. Valley Electrical — clean
invoice(
    os.path.join(OUT, "valley-electrical-INV-58213.pdf"),
    "Valley Electrical Supply Co.",
    ["2280 Rancho Cordova Blvd, Rancho Cordova, CA 95670", "(916) 555-0148  ·  ar@valleyelecsupply.example"],
    "#2f6e9e",
    [("Invoice #", "INV-58213"), ("Invoice date", "08/28/2026"), ("Due date", "09/27/2026"),
     ("Customer PO", "24-1187-014"), ("Job #", "24-1187"), ("Job name", "Westpark Medical Office Bldg")],
    [('3/4" EMT conduit, 10 ft', 400, "STK", 8.45, 3380.00),
     ("12 AWG THHN copper, 500 ft reel", 12, "RL", 96.50, 1158.00),
     ('4" square box, 2-1/8" deep', 250, "EA", 3.18, 795.00),
     ("20A 1-pole breaker", 60, "EA", 21.75, 1305.00),
     ('Strut channel 1-5/8", 10 ft', 40, "EA", 28.90, 1156.00)],
    7794.00, "Sales tax 8.75%", 681.98, 8475.98,
    "Terms: Net 30. Please reference invoice number with payment. Thank you for your business.",
)

# 2. Summit — transposed line amount (48 x 9.65 = 463.20, printed 436.20)
invoice(
    os.path.join(OUT, "summit-conduit-10447.pdf"),
    "Summit Conduit & Wire",
    ["915 Harbor Blvd, West Sacramento, CA 95691", "(916) 555-0193"],
    "#8a5a2b",
    [("Invoice #", "10447"), ("Invoice date", "09/02/2026"), ("Due date", "10/02/2026"),
     ("Customer PO", "24-1215-006"), ("Job #", "24-1215"), ("Job name", "Lakeview Elementary Modernization")],
    [('2" PVC Sch 40 conduit, 10 ft', 120, "STK", 14.20, 1704.00),
     ('2" PVC 90 deg elbow', 48, "EA", 9.65, 436.20),
     ("Pull string, 2500 ft", 4, "EA", 42.00, 168.00),
     ("Wire pulling lubricant, 1 qt", 6, "EA", 18.50, 111.00)],
    2446.20, "Sales tax 8.75%", 214.04, 2660.24,
    "Net 30. 1.5% monthly finance charge on past-due balances.",
)

# 3. Change order request
c = canvas.Canvas(os.path.join(OUT, "pacific-lv-COR-007.pdf"), pagesize=letter)
header(c, "Pacific Fire & Low Voltage Inc.", ["77 Commerce Cir, Elk Grove, CA 95758", "CSLB Lic. C-7 / C-10 (sample)"],
       "CHANGE ORDER REQUEST", "#5b3f86")
kv_block(c, W - 280, H - 110, [("COR #", "COR-007"), ("Date", "09/10/2026"), ("Job #", "24-1203"),
                               ("Project", "Harbor Point Data Center Ph. 2")])
c.setFont("Helvetica", 9); c.setFillColor(MUTED); c.drawString(50, H - 120, "TO")
c.setFillColor(INK); c.setFont("Helvetica-Bold", 10); c.drawString(50, H - 134, "Northgate Electric & Controls")
c.setFont("Helvetica", 9); c.drawString(50, H - 147, "Attn: K. Nguyen, Project Manager")
c.setFont("Helvetica-Bold", 10); c.drawString(50, H - 185, "Scope")
c.setFont("Helvetica", 9)
c.drawString(50, H - 199, "Per RFI-031 and revised drawing T-201 rev 3: add 24 horizontal Cat6A drops and six 2-post racks")
c.drawString(50, H - 211, "in Data Hall B. Work to be performed during off-hours per owner's access schedule.")
rows = [["Labor: journeyman technician", "160", "HR", money(118.00), money(18880.00)],
        ["Material: Cat6A plenum cable, 1000 ft box", "18", "BX", money(412.00), money(7416.00)],
        ["Material: 2-post equipment rack", "6", "EA", money(685.00), money(4110.00)],
        ["Markup on material, 10%", "1", "LS", money(1152.60), money(1152.60)]]
y = table(c, H - 250, ["Description", "Qty", "Unit", "Rate", "Amount"], rows, [260, 50, 45, 76, 81], ["l", "r", "l", "r", "r"])
totals(c, y - 14, [("Subtotal", money(31558.60), False), ("Total change order request", money(31558.60), True)])
c.setFont("Helvetica", 9); c.setFillColor(INK)
c.drawString(50, 150, "Schedule impact: 4 working days.")
c.drawString(50, 120, "Submitted by: ______________________     Approved by: ______________________")
footer(c, "This request is valid for 30 days. Work will not proceed until a signed change order is received.")
c.save()

# 4. Submittal transmittal
c = canvas.Canvas(os.path.join(OUT, "brightline-submittal-265100-003.pdf"), pagesize=letter)
header(c, "Brightline Lighting Distributors", ["3100 Power Inn Rd, Sacramento, CA 95826", "submittals@brightline.example"],
       "SUBMITTAL", "#2e7d5b")
kv_block(c, W - 290, H - 110, [("Submittal #", "26 51 00-003"), ("Date", "09/15/2026"), ("Spec section", "26 51 00 Interior Lighting"),
                               ("Job #", "25-0042"), ("Project", "Riverbend Water Treatment Upgrade")], label_w=80)
c.setFont("Helvetica", 9); c.setFillColor(MUTED); c.drawString(50, H - 120, "TO")
c.setFillColor(INK); c.setFont("Helvetica-Bold", 10); c.drawString(50, H - 134, "Northgate Electric & Controls")
c.setFont("Helvetica", 9); c.drawString(50, H - 147, "Attn: Project Engineer")
c.drawString(50, H - 175, "Submitted for: [X] Approval   [ ] Record   [ ] Resubmittal")
rows = [["Type A: LED high bay, 24,000 lm, 4000K", "Lumenfield", "HB-24L-40K", "36"],
        ["Type B: 4 ft vapor-tight linear LED, 5,000 lm", "Lumenfield", "VT4-50L-40K", "58"],
        ["Type EM: emergency battery pack, 10 W", "Lumenfield", "EMB-10W", "20"]]
table(c, H - 215, ["Fixture", "Manufacturer", "Catalog #", "Qty"], rows, [250, 90, 100, 72], ["l", "l", "l", "r"])
c.setFont("Helvetica", 9)
c.drawString(50, H - 320, "Enclosed: product data sheets, photometric reports, IES files, UL listing cards.")
c.drawString(50, H - 334, "Deviations from specification: none.")
footer(c, "Reviewer stamp area below. Return within 10 business days to hold quoted lead times.")
c.setStrokeColor(RULE); c.rect(50, 80, 250, 120)
c.save()
print("wrote", sorted(os.listdir(OUT)))
