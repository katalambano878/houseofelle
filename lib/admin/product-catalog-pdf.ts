import { jsPDF } from 'jspdf';

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku?: string | null;
  category?: string;
  status?: string;
  imageUrl?: string;
};

export type GenerateCatalogPdfOptions = {
  title?: string;
  subtitle?: string;
  onProgress?: (current: number, total: number) => void;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * jsPDF only reliably embeds PNG and JPEG. Other formats (WebP, AVIF, GIF, …) are decoded by the
 * browser, drawn onto a canvas over a white background and re-exported as JPEG.
 */
async function blobToJpegDataUrl(blob: Blob, maxSide = 600): Promise<string | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image could not be decoded'));
      el.src = objectUrl;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type.toLowerCase();
    if (type === 'image/png') {
      return { dataUrl: await blobToDataUrl(blob), format: 'PNG' };
    }
    if (type === 'image/jpeg' || type === 'image/jpg') {
      return { dataUrl: await blobToDataUrl(blob), format: 'JPEG' };
    }
    const jpeg = await blobToJpegDataUrl(blob);
    return jpeg ? { dataUrl: jpeg, format: 'JPEG' } : null;
  } catch {
    return null;
  }
}

function drawPlaceholder(doc: jsPDF, x: number, y: number, size: number) {
  doc.setDrawColor(200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(x, y, size, size, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('No image', x + size / 2, y + size / 2, { align: 'center', baseline: 'middle' });
  doc.setTextColor(0);
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `House of Elle — Product catalog — Page ${pageNum} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );
  doc.setTextColor(0);
}

/**
 * Builds and downloads a PDF catalog with product image, name, price, and stock.
 */
export async function generateProductCatalogPdf(
  products: CatalogProduct[],
  options: GenerateCatalogPdfOptions = {}
): Promise<void> {
  if (products.length === 0) {
    throw new Error('No products to export');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const imgSize = 24;
  const rowGap = 6;
  const minRowHeight = imgSize + 4;

  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(options.title ?? 'House of Elle', margin, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(options.subtitle ?? 'Product catalog', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(90);
  const dateStr = new Date().toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  doc.text(`${dateStr}  •  ${products.length} product${products.length === 1 ? '' : 's'}`, margin, y);
  y += 5;

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setTextColor(0);

  // Column headers
  const colNameX = margin + imgSize + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('PRODUCT', colNameX, y);
  doc.text('PRICE', pageWidth - margin - 52, y);
  doc.text('STOCK', pageWidth - margin - 22, y);
  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');

  const pageBreak = () => {
    doc.addPage();
    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('PRODUCT', colNameX, y);
    doc.text('PRICE', pageWidth - margin - 52, y);
    doc.text('STOCK', pageWidth - margin - 22, y);
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
  };

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    options.onProgress?.(i + 1, products.length);

    const nameLines = doc.splitTextToSize(product.name, contentWidth - imgSize - 70);
    const detailLines = 2 + (product.sku ? 1 : 0) + (product.category ? 1 : 0);
    const rowHeight = Math.max(minRowHeight, nameLines.length * 4.5 + detailLines * 4 + 4);

    if (y + rowHeight > pageHeight - 18) {
      pageBreak();
    }

    const rowY = y;

    // Image
    if (product.imageUrl && !product.imageUrl.includes('house-of-elle-logo')) {
      const loaded = await loadImageAsDataUrl(product.imageUrl);
      if (loaded) {
        try {
          doc.addImage(loaded.dataUrl, loaded.format, margin, rowY, imgSize, imgSize);
        } catch {
          drawPlaceholder(doc, margin, rowY, imgSize);
        }
      } else {
        drawPlaceholder(doc, margin, rowY, imgSize);
      }
    } else {
      drawPlaceholder(doc, margin, rowY, imgSize);
    }

    // Name & details
    let textY = rowY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(nameLines, colNameX, textY);
    textY += nameLines.length * 4.5 + 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    if (product.category) {
      doc.text(product.category, colNameX, textY);
      textY += 4;
    }
    if (product.sku) {
      doc.text(`SKU: ${product.sku}`, colNameX, textY);
      textY += 4;
    }
    if (product.status) {
      doc.text(`Status: ${product.status}`, colNameX, textY);
    }
    doc.setTextColor(0);

    // Price & stock (right-aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const priceLabel = `GHS ${product.price.toFixed(2)}`;
    doc.text(priceLabel, pageWidth - margin - 52, rowY + 8);
    doc.text(String(product.stock), pageWidth - margin - 22, rowY + 8);

    y = rowY + rowHeight + rowGap;

    if (i < products.length - 1) {
      doc.setDrawColor(235);
      doc.line(margin, y - rowGap / 2, pageWidth - margin, y - rowGap / 2);
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, p, totalPages);
  }

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`house-of-elle-catalog-${fileDate}.pdf`);
}
