import PDFDocument from 'pdfkit';
import { BastRecord, ParameterItem } from './types';

const MONTH_NAMES_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Helper to calculate week of month based on calendar
export function getCalendarWeekOfMonth(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 1;
  const day = d.getDate();
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay(); // 0 is Sunday
  // Offset by day of week of the 1st
  const adjustedDate = day + firstDay;
  return Math.min(5, Math.ceil(adjustedDate / 7));
}

// Format date to Indonesian: e.g. "20-Oktober 2026"
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const monthName = MONTH_NAMES_INDONESIA[m - 1] || parts[1];
    return `${d}-${monthName} ${y}`;
  }
  return dateStr;
}

export function generateBastPdf(
  bastNo: string,
  records: BastRecord[],
  parameters: ParameterItem[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Configuration parameters from database or defaults matching the official template
      const formNoParam = parameters.find((p) => p.Key === 'BAST_TEMPLATE_FORM_NO');
      const formRevParam = parameters.find((p) => p.Key === 'BAST_TEMPLATE_REVISI');
      const formDateParam = parameters.find((p) => p.Key === 'BAST_TEMPLATE_BERLAKU');

      const formNo = formNoParam?.Value || 'FOR-AFT-10';
      const formRev = formRevParam?.Value || '04';
      const formDate = formDateParam?.Value || '12.07.2024';

      // Determine period and week from reception date
      const primaryRecord = records[0];
      const receptionDateStr = primaryRecord?.TanggalPenerimaan || primaryRecord?.Tanggal || '2026-10-20';
      const recDate = new Date(receptionDateStr);
      const recMonth = isNaN(recDate.getMonth()) ? 9 : recDate.getMonth();
      const recYear = isNaN(recDate.getFullYear()) ? 2026 : recDate.getFullYear();
      const monthName = MONTH_NAMES_INDONESIA[recMonth] || 'Oktober';
      const periodeStr = `${monthName} - ${recYear}`;
      const weekNumber = getCalendarWeekOfMonth(receptionDateStr);

      // Create PDF Document (A4 Landscape)
      // A4 Landscape size: 841.89 x 595.28 points
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 32, bottom: 32, left: 40, right: 40 },
        bufferPages: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const marginLeft = 40;
      const marginRight = 40;
      const usableWidth = pageWidth - marginLeft - marginRight; // 761.89 pt

      // Column widths definition (Exact proportions matching the template image + 2 new columns)
      const colWidths = {
        no: 24,
        jenisAsset: 60,
        spesifikasi: 140,
        tanggal: 66,
        noAsset: 88,
        jumlah: 26,
        kondisiBaik: 20,
        kondisiLayak: 20,
        kondisiRusak: 20,
        bidang: 46,
        tandaTangan: 60,
        bidangPengguna: 46,
        tandaTanganPengguna: 60,
        keterangan: 85.89,
      };

      const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0); // 761.89 pt

      // Function to draw header of page
      const drawHeader = (startY = 32) => {
        // 1. Top Right Box (No, Revisi, Berlaku mulai tgl)
        const boxWidth = 115;
        const boxHeight = 44;
        const boxX = pageWidth - marginRight - boxWidth;
        const boxY = startY;

        doc.rect(boxX, boxY, boxWidth, boxHeight).lineWidth(0.8).strokeColor('#000000').stroke();
        doc.moveTo(boxX, boxY + 15).lineTo(boxX + boxWidth, boxY + 15).lineWidth(0.5).stroke();
        doc.moveTo(boxX, boxY + 29).lineTo(boxX + boxWidth, boxY + 29).lineWidth(0.5).stroke();

        doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
        doc.text(`No : ${formNo}`, boxX + 5, boxY + 4);
        doc.text(`Revisi : ${formRev}`, boxX + 5, boxY + 18);
        doc.text(`Berlaku mulai tgl. : ${formDate}`, boxX + 5, boxY + 32);

        // 2. Centered Document Title
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
        doc.text('BUKTI SERAH TERIMA ASSET', marginLeft, startY + 8, {
          width: usableWidth,
          align: 'center',
        });

        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#000000');
        doc.text(`No. ${bastNo}`, marginLeft, startY + 25, {
          width: usableWidth,
          align: 'center',
        });

        // 3. Information Lines below header
        const metaY = startY + 54;

        // Left meta
        doc.font('Helvetica').fontSize(8.5).fillColor('#000000');
        doc.text('Telah diinformasikan dari bidang ke AM', marginLeft, metaY);
        doc.text('Barang sebagai berikut :', marginLeft, metaY + 12);

        // Right meta
        const rightTextWidth = 260;
        const rightX = pageWidth - marginRight - rightTextWidth;
        doc.text(`Periode Tanggal Penerimaan Asset : ${periodeStr}`, rightX, metaY, {
          width: rightTextWidth,
          align: 'right',
        });
        doc.text(`Minggu ke : ${weekNumber}`, rightX, metaY + 12, {
          width: rightTextWidth,
          align: 'right',
        });

        return metaY + 28; // Table start Y
      };

      // Function to draw Table Header (2 tiers with green background)
      const drawTableHeader = (tableY: number) => {
        const headerHeight = 32;
        const tier1H = 16;
        const tier2H = 16;

        // Background color for header (#E5EFE0 soft sage green)
        doc.rect(marginLeft, tableY, tableWidth, headerHeight).fillColor('#E5EFE0').fill();

        // Outer border
        doc.rect(marginLeft, tableY, tableWidth, headerHeight).lineWidth(0.8).strokeColor('#000000').stroke();

        // Horizontal line under "Kondisi"
        const kondisiX =
          marginLeft +
          colWidths.no +
          colWidths.jenisAsset +
          colWidths.spesifikasi +
          colWidths.tanggal +
          colWidths.noAsset +
          colWidths.jumlah;
        const kondisiTotalWidth = colWidths.kondisiBaik + colWidths.kondisiLayak + colWidths.kondisiRusak;

        doc.moveTo(kondisiX, tableY + tier1H).lineTo(kondisiX + kondisiTotalWidth, tableY + tier1H).lineWidth(0.8).stroke();

        // Vertical lines for main columns
        let curX = marginLeft;
        const cols = [
          colWidths.no,
          colWidths.jenisAsset,
          colWidths.spesifikasi,
          colWidths.tanggal,
          colWidths.noAsset,
          colWidths.jumlah,
        ];

        for (const w of cols) {
          curX += w;
          doc.moveTo(curX, tableY).lineTo(curX, tableY + headerHeight).lineWidth(0.8).stroke();
        }

        // Inside Kondisi subcolumns (Tier 2 only)
        doc.moveTo(curX + colWidths.kondisiBaik, tableY + tier1H).lineTo(curX + colWidths.kondisiBaik, tableY + headerHeight).lineWidth(0.8).stroke();
        doc.moveTo(curX + colWidths.kondisiBaik + colWidths.kondisiLayak, tableY + tier1H).lineTo(curX + colWidths.kondisiBaik + colWidths.kondisiLayak, tableY + headerHeight).lineWidth(0.8).stroke();

        curX += kondisiTotalWidth;
        doc.moveTo(curX, tableY).lineTo(curX, tableY + headerHeight).lineWidth(0.8).stroke(); // after Kondisi

        curX += colWidths.bidang;
        doc.moveTo(curX, tableY).lineTo(curX, tableY + headerHeight).lineWidth(0.8).stroke(); // after Bidang

        curX += colWidths.tandaTangan;
        doc.moveTo(curX, tableY).lineTo(curX, tableY + headerHeight).lineWidth(0.8).stroke(); // after Tanda tangan

        curX += colWidths.bidangPengguna;
        doc.moveTo(curX, tableY).lineTo(curX, tableY + headerHeight).lineWidth(0.8).stroke(); // after Bidang Pengguna

        curX += colWidths.tandaTanganPengguna;
        doc.moveTo(curX, tableY).lineTo(curX, tableY + headerHeight).lineWidth(0.8).stroke(); // after Tanda Tangan (Pengguna)

        // Text labels inside header
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');

        let tx = marginLeft;
        // No
        doc.text('No', tx, tableY + 11, { width: colWidths.no, align: 'center' });
        tx += colWidths.no;

        // Jenis Asset
        doc.text('Jenis Asset', tx, tableY + 11, { width: colWidths.jenisAsset, align: 'center' });
        tx += colWidths.jenisAsset;

        // Identitas/Spesifikasi
        doc.text('Identitas/Spesifikasi', tx, tableY + 11, { width: colWidths.spesifikasi, align: 'center' });
        tx += colWidths.spesifikasi;

        // Tanggal diterima
        doc.text('Tanggal diterima', tx, tableY + 11, { width: colWidths.tanggal, align: 'center' });
        tx += colWidths.tanggal;

        // No Asset
        doc.text('No Asset', tx, tableY + 11, { width: colWidths.noAsset, align: 'center' });
        tx += colWidths.noAsset;

        // Jumlah
        doc.text('Jumlah', tx, tableY + 11, { width: colWidths.jumlah, align: 'center' });
        tx += colWidths.jumlah;

        // Kondisi Header (Tier 1)
        doc.text('Kondisi', tx, tableY + 4, { width: kondisiTotalWidth, align: 'center' });

        // Subcolumns (Tier 2)
        doc.font('Helvetica').fontSize(7);
        doc.text('Baik', tx, tableY + 19, { width: colWidths.kondisiBaik, align: 'center' });
        doc.text('Layak\npakai', tx + colWidths.kondisiBaik, tableY + 17, { width: colWidths.kondisiLayak, align: 'center' });
        doc.text('Rusak', tx + colWidths.kondisiBaik + colWidths.kondisiLayak, tableY + 19, { width: colWidths.kondisiRusak, align: 'center' });

        tx += kondisiTotalWidth;
        doc.font('Helvetica-Bold').fontSize(8);

        // Bidang (Pengadaan)
        doc.text('Bidang', tx, tableY + 11, { width: colWidths.bidang, align: 'center' });
        tx += colWidths.bidang;

        // Tanda tangan (Pengadaan)
        doc.text('Tanda tangan', tx, tableY + 11, { width: colWidths.tandaTangan, align: 'center' });
        tx += colWidths.tandaTangan;

        // Bidang Pengguna
        doc.font('Helvetica-Bold').fontSize(7);
        doc.text('Bidang\nPengguna', tx, tableY + 7, { width: colWidths.bidangPengguna, align: 'center' });
        tx += colWidths.bidangPengguna;

        // Tanda Tangan (Pengguna)
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('Tanda Tangan', tx, tableY + 11, { width: colWidths.tandaTanganPengguna, align: 'center' });
        tx += colWidths.tandaTanganPengguna;

        // Keterangan
        doc.text('Keterangan', tx, tableY + 11, { width: colWidths.keterangan, align: 'center' });

        return tableY + headerHeight;
      };

      // Draw first page header & table header
      let currentTableY = drawTableHeader(drawHeader(32));

      // Prepare items: minimum 4 rows on the page to match official template layout
      const rowCount = Math.max(records.length, 4);

      for (let i = 0; i < rowCount; i++) {
        const item = records[i] || null;
        const rowNum = i + 1;

        // Compute needed row height based on content
        let specHeight = 35;
        let ketHeight = 35;
        if (item) {
          if (item.DetailSpesifikasi) {
            // estimate text length
            const lines = Math.ceil(item.DetailSpesifikasi.length / 32) + 1;
            specHeight = Math.max(45, lines * 11);
          }
          if (item.NomorUPA) {
            ketHeight = 45;
          }
        }
        const rowHeight = Math.max(50, specHeight, ketHeight);

        // Check if page break is needed
        if (currentTableY + rowHeight > pageHeight - 75) {
          doc.addPage();
          currentTableY = drawTableHeader(drawHeader(32));
        }

        // Draw Row rectangle and grid lines
        doc.rect(marginLeft, currentTableY, tableWidth, rowHeight).lineWidth(0.8).strokeColor('#000000').stroke();

        let curX = marginLeft;
        const colList = [
          colWidths.no,
          colWidths.jenisAsset,
          colWidths.spesifikasi,
          colWidths.tanggal,
          colWidths.noAsset,
          colWidths.jumlah,
          colWidths.kondisiBaik,
          colWidths.kondisiLayak,
          colWidths.kondisiRusak,
          colWidths.bidang,
          colWidths.tandaTangan,
          colWidths.bidangPengguna,
          colWidths.tandaTanganPengguna,
          colWidths.keterangan,
        ];

        for (let c = 0; c < colList.length - 1; c++) {
          curX += colList[c];
          doc.moveTo(curX, currentTableY).lineTo(curX, currentTableY + rowHeight).lineWidth(0.8).stroke();
        }

        // Render Cell Contents
        const textY = currentTableY + 8;

        // 1. No.
        doc.font('Helvetica').fontSize(8.5).fillColor('#000000');
        doc.text(String(rowNum), marginLeft, textY + 8, {
          width: colWidths.no,
          align: 'center',
        });

        if (item) {
          let rx = marginLeft + colWidths.no;

          // 2. Jenis Asset
          doc.font('Helvetica-Bold').fontSize(8);
          doc.text(item.NamaBarang || item.JenisBarang || '', rx + 3, textY + 6, {
            width: colWidths.jenisAsset - 6,
            align: 'center',
          });
          rx += colWidths.jenisAsset;

          // 3. Identitas / Spesifikasi
          doc.font('Helvetica').fontSize(7.5);
          const fullSpec = item.DetailSpesifikasi || item.NamaBarang || '';
          doc.text(fullSpec, rx + 4, textY, {
            width: colWidths.spesifikasi - 8,
            align: 'left',
          });
          rx += colWidths.spesifikasi;

          // 4. Tanggal diterima
          const tglFormatted = formatIndonesianDate(item.TanggalPenerimaan || item.Tanggal);
          doc.font('Helvetica').fontSize(7.5);
          doc.text(tglFormatted, rx + 2, textY + 6, {
            width: colWidths.tanggal - 4,
            align: 'center',
          });
          rx += colWidths.tanggal;

          // 5. No Asset
          doc.font('Helvetica').fontSize(7.5);
          doc.text(item.AssetNumber || '', rx + 2, textY + 6, {
            width: colWidths.noAsset - 4,
            align: 'center',
          });
          rx += colWidths.noAsset;

          // 6. Jumlah
          doc.font('Helvetica').fontSize(8.5);
          doc.text('1', rx, textY + 6, {
            width: colWidths.jumlah,
            align: 'center',
          });
          rx += colWidths.jumlah;

          // 7. Kondisi (3 sub-columns blank for physical inspection)
          rx += colWidths.kondisiBaik + colWidths.kondisiLayak + colWidths.kondisiRusak;

          // 8. Bidang (Pengadaan)
          doc.font('Helvetica').fontSize(8);
          doc.text(item.BidangPengadaan || item.Bidang || '', rx, textY + 6, {
            width: colWidths.bidang,
            align: 'center',
          });
          rx += colWidths.bidang;

          // 9. Tanda tangan (Pengadaan): dotted signature line and "Kabag / Kadept" text
          const sigLineY = currentTableY + rowHeight - 20;
          doc.font('Helvetica').fontSize(7.5);
          doc.text('....................', rx, sigLineY - 4, {
            width: colWidths.tandaTangan,
            align: 'center',
          });
          doc.text('Kabag /', rx, sigLineY + 5, {
            width: colWidths.tandaTangan,
            align: 'center',
          });
          doc.text('Kadept', rx, sigLineY + 12, {
            width: colWidths.tandaTangan,
            align: 'center',
          });
          rx += colWidths.tandaTangan;

          // 10. Bidang Pengguna
          doc.font('Helvetica').fontSize(8);
          doc.text(item.BidangPengguna || '', rx, textY + 6, {
            width: colWidths.bidangPengguna,
            align: 'center',
          });
          rx += colWidths.bidangPengguna;

          // 11. Tanda Tangan (Pengguna): dotted signature line and "Kabag / Kadept" text
          doc.font('Helvetica').fontSize(7.5);
          doc.text('....................', rx, sigLineY - 4, {
            width: colWidths.tandaTanganPengguna,
            align: 'center',
          });
          doc.text('Kabag /', rx, sigLineY + 5, {
            width: colWidths.tandaTanganPengguna,
            align: 'center',
          });
          doc.text('Kadept', rx, sigLineY + 12, {
            width: colWidths.tandaTanganPengguna,
            align: 'center',
          });
          rx += colWidths.tandaTanganPengguna;

          // 12. Keterangan
          doc.font('Helvetica').fontSize(7);
          let ketText = '';
          if (item.NomorUPA) {
            ketText += `${item.NomorUPA}\n`;
          }
          if (item.LokasiDistribusi) {
            ketText += `Lokasi: ${item.LokasiDistribusi}\n`;
          }
          if (item.NomorSerial) {
            ketText += `SN: ${item.NomorSerial}`;
          }
          doc.text(ketText.trim(), rx + 4, textY, {
            width: colWidths.keterangan - 8,
            align: 'left',
          });
        } else {
          // Empty template row for visual balance matching template
          const sigLineY = currentTableY + rowHeight - 20;
          doc.font('Helvetica').fontSize(7.5).fillColor('#000000');

          // Render signature line in first Tanda tangan column (Pengadaan)
          const rx1 =
            marginLeft +
            colWidths.no +
            colWidths.jenisAsset +
            colWidths.spesifikasi +
            colWidths.tanggal +
            colWidths.noAsset +
            colWidths.jumlah +
            colWidths.kondisiBaik +
            colWidths.kondisiLayak +
            colWidths.kondisiRusak +
            colWidths.bidang;

          doc.text('....................', rx1, sigLineY - 4, {
            width: colWidths.tandaTangan,
            align: 'center',
          });
          doc.text('Kabag /', rx1, sigLineY + 5, {
            width: colWidths.tandaTangan,
            align: 'center',
          });
          doc.text('Kadept', rx1, sigLineY + 12, {
            width: colWidths.tandaTangan,
            align: 'center',
          });

          // Render signature line in second Tanda Tangan column (Pengguna)
          const rx2 = rx1 + colWidths.tandaTangan + colWidths.bidangPengguna;
          doc.text('....................', rx2, sigLineY - 4, {
            width: colWidths.tandaTanganPengguna,
            align: 'center',
          });
          doc.text('Kabag /', rx2, sigLineY + 5, {
            width: colWidths.tandaTanganPengguna,
            align: 'center',
          });
          doc.text('Kadept', rx2, sigLineY + 12, {
            width: colWidths.tandaTanganPengguna,
            align: 'center',
          });
        }

        currentTableY += rowHeight;
      }

      // Bottom Section: Diterima and AM Signature
      const bottomY = currentTableY + 16;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      doc.text('Diterima', marginLeft + 45, bottomY);

      doc.font('Helvetica').fontSize(8.5);
      doc.text('.....................................', marginLeft + 25, bottomY + 22);

      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('AM', marginLeft + 45, bottomY + 34);

      // Finalize PDF file
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
