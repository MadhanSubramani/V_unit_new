import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

type DocInput = { url: string; name?: string };

function isPdf(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return target.includes(".pdf");
}

function isImage(url: string, name?: string) {
  const target = `${name ?? ""} ${url}`.toLowerCase();
  return /\.(png|jpe?g|webp|gif)(\?|$)/.test(target);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { documents?: DocInput[] };
    const documents = body.documents?.filter((doc) => doc?.url) ?? [];
    if (!documents.length) {
      return NextResponse.json({ error: "No documents provided." }, { status: 400 });
    }

    const merged = await PDFDocument.create();

    for (const doc of documents) {
      const response = await fetch(doc.url);
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());

      if (isPdf(doc.url, doc.name)) {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        continue;
      }

      if (isImage(doc.url, doc.name)) {
        const page = merged.addPage([595, 842]);
        const embedded = doc.url.toLowerCase().includes(".png")
          ? await merged.embedPng(bytes)
          : await merged.embedJpg(bytes);
        const scale = Math.min(
          page.getWidth() / embedded.width,
          page.getHeight() / embedded.height
        );
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        page.drawImage(embedded, {
          x: (page.getWidth() - width) / 2,
          y: (page.getHeight() - height) / 2,
          width,
          height,
        });
      }
    }

    if (merged.getPageCount() === 0) {
      return NextResponse.json(
        { error: "No supported documents could be merged." },
        { status: 400 }
      );
    }

    const pdfBytes = await merged.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="import-documents.pdf"',
      },
    });
  } catch (error) {
    console.error("merge-documents:", error);
    return NextResponse.json(
      { error: "Failed to merge documents." },
      { status: 500 }
    );
  }
}
