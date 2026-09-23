# DocRoute: guide for AP and project staff

DocRoute reads vendor paperwork for you. You check its work and make the call.

## Adding a document

1. Open DocRoute and drag the PDF onto **Drop a PDF here**, or click the box to choose a file.
2. Wait 5 to 20 seconds. The document opens when it's ready.

Use PDFs under 4 MB. If a scan is bigger, re-scan it at 200 dpi in black and white.

## Reviewing a document

The original PDF is on the left. On the right, top to bottom:

- **Goes to**: who should approve it and why.
- **Checks**: problems are listed first. A red mark means something is wrong; orange means take a look.
- **Decision**: approve or reject.
- **What was read**: every value DocRoute pulled from the PDF. Values that failed a check are **highlighted in yellow**.

Compare the highlighted values with the PDF. Most of the time the problem is on the vendor's document, not DocRoute's reading of it.

## Approving and rejecting

- **Approve** sends the document to the ERP and posts a message to the team channel.
- If the document failed a check, the button says **Approve anyway** and you must write a note saying why it's OK, for example "Vendor confirmed $463.20 by phone; they'll send a credit memo."
- **Reject** always needs a note, so the vendor or PM knows what to fix.

Once approved or rejected, a document can't be changed here. Contact the AP lead to reverse it in the ERP.

## What the checks mean

| Check | What to do if it fails |
|---|---|
| Required fields present | The PDF may be cut off or missing a page. Get a complete copy. |
| Job number matches ERP | Wrong or closed job. Confirm the job with the PM before approving. |
| Line items multiply correctly | Vendor arithmetic error. Ask for a corrected invoice or credit memo. |
| Lines add up to subtotal | Usually follows a line error. Same fix. |
| Subtotal + tax = total | Check the tax rate the vendor used. |
| Not a duplicate | This invoice number was already entered. Don't pay twice. Reject it. |
| Due date after document date | Usually a typo on the invoice. Note it and approve if terms are normal. |
| Model confident | The PDF was hard to read. Check every highlighted value against the PDF. |

## Data handling

Only upload business documents you're allowed to share with the AI service your company has approved. Don't upload documents containing employee personal information, bank account numbers, or Social Security numbers.
