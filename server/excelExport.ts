import ExcelJS from 'exceljs';
import { BastRecord, DataInventaris, DataPenarikan, FotoInventaris } from './types';

// Helper to style header row
function applyHeaderStyle(row: ExcelJS.Row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Navy Blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

function applyDataRowStyle(row: ExcelJS.Row, isEven: boolean) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }, // Soft alternating gray
      };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });
}

export async function exportDaftarBast(records: BastRecord[], photos: FotoInventaris[], originUrl = ''): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BAST & Inventory Asset Management';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Daftar BAST', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
  });

  sheet.columns = [
    { header: 'No.', key: 'no', width: 6 },
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'Bulan', key: 'bulan', width: 8 },
    { header: 'Tahun', key: 'tahun', width: 8 },
    { header: 'Bidang Pengadaan', key: 'bidangPengadaan', width: 16 },
    { header: 'Bidang Pengguna', key: 'bidangPengguna', width: 16 },
    { header: 'Nomor BAST', key: 'bastNo', width: 28 },
    { header: 'Nama Barang', key: 'namaBarang', width: 26 },
    { header: 'Unique Name', key: 'uniqueName', width: 14 },
    { header: 'Detail / Spesifikasi', key: 'detail', width: 36 },
    { header: 'Nomor Serial', key: 'nomorSerial', width: 20 },
    { header: 'Lokasi Distribusi', key: 'lokasi', width: 26 },
    { header: 'Nomor UPA', key: 'nomorUPA', width: 18 },
    { header: 'Tanggal Penerimaan', key: 'tanggalPenerimaan', width: 16 },
    { header: 'Nomor Inventaris', key: 'assetNumber', width: 24 },
    { header: 'Foto', key: 'foto', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  records.forEach((r, idx) => {
    const rowNum = idx + 2;
    const assetPhotos = photos.filter((p) => p.AssetID === r.AssetID && p.StatusFoto === 'Aktif');
    const photoText = assetPhotos.length > 0 ? `${assetPhotos.length} Foto` : 'Tidak Ada Foto';
    const mainPhoto = assetPhotos[0];

    const row = sheet.addRow({
      no: idx + 1,
      tanggal: r.Tanggal,
      bulan: r.Bulan,
      tahun: r.Tahun,
      bidangPengadaan: r.BidangPengadaan || r.Bidang || '-',
      bidangPengguna: r.BidangPengguna || '-',
      bastNo: r.BASTNo,
      namaBarang: r.NamaBarang,
      uniqueName: r.UniqueName,
      detail: r.DetailSpesifikasi || '-',
      nomorSerial: r.NomorSerial || '-',
      lokasi: r.LokasiDistribusi || '-',
      nomorUPA: r.NomorUPA || '-',
      tanggalPenerimaan: r.TanggalPenerimaan || '-',
      assetNumber: r.AssetNumber,
      foto: photoText,
      status: r.Status,
    });

    applyDataRowStyle(row, idx % 2 === 1);

    // Set numbers as text to prevent excel stripping leading zeroes
    row.getCell('bastNo').numFmt = '@';
    row.getCell('assetNumber').numFmt = '@';
    row.getCell('nomorSerial').numFmt = '@';

    // Add hyperlink if photo exists
    if (mainPhoto && mainPhoto.PhotoURL) {
      const cell = row.getCell('foto');
      cell.value = {
        text: `Lihat Foto (${assetPhotos.length})`,
        hyperlink: mainPhoto.PhotoURL.startsWith('http') ? mainPhoto.PhotoURL : `${originUrl}${mainPhoto.PhotoURL}`,
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF2563EB' }, underline: true };
    }
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: records.length + 1, column: 16 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportDaftarInventaris(
  records: DataInventaris[],
  photos: FotoInventaris[],
  originUrl = '',
  isFormPemeriksaan = false
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BAST & Inventory Asset Management';
  workbook.created = new Date();

  const sheetTitle = isFormPemeriksaan ? 'Form Pemeriksaan Aset' : 'Monitoring Inventaris';
  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
  });

  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'No.', key: 'no', width: 6 },
    { header: 'Nomor Inventaris', key: 'assetNumber', width: 24 },
    { header: 'Jenis Barang', key: 'jenisBarang', width: 24 },
    { header: 'Detail / Spesifikasi', key: 'detail', width: 36 },
    { header: 'Nomor Serial', key: 'nomorSerial', width: 20 },
    { header: 'Jumlah', key: 'jumlah', width: 8 },
    { header: 'Bidang Pengadaan', key: 'bidangPengadaan', width: 16 },
    { header: 'Bidang Pengguna', key: 'bidangPengguna', width: 16 },
    { header: 'Tanggal Perolehan', key: 'tanggalPerolehan', width: 16 },
    { header: 'Kondisi', key: 'kondisi', width: 16 },
    { header: 'Lokasi', key: 'lokasi', width: 26 },
    { header: 'Foto', key: 'foto', width: 18 },
  ];

  if (isFormPemeriksaan) {
    // 3 extra columns for physical audit
    columns.push(
      { header: 'Hasil Pemeriksaan', key: 'hasilPemeriksaan', width: 22 },
      { header: 'Catatan Pemeriksaan', key: 'catatanPemeriksaan', width: 30 },
      { header: 'Tanggal Pemeriksaan', key: 'tanggalPemeriksaan', width: 20 }
    );
  }

  sheet.columns = columns;
  applyHeaderStyle(sheet.getRow(1));

  if (isFormPemeriksaan) {
    // Highlight the 3 extra examination columns in header with teal/amber
    const colCount = columns.length;
    for (let c = colCount - 2; c <= colCount; c++) {
      const cell = sheet.getRow(1).getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D9488' }, // Teal
      };
    }
  }

  records.forEach((r, idx) => {
    const assetPhotos = photos.filter((p) => p.AssetID === r.AssetID && p.StatusFoto === 'Aktif');
    const photoText = assetPhotos.length > 0 ? `${assetPhotos.length} Foto` : 'Tidak Ada Foto';
    const mainPhoto = assetPhotos[0];

    const rowData: Record<string, any> = {
      no: idx + 1,
      assetNumber: r.AssetNumber,
      jenisBarang: r.JenisBarang || r.NamaBarang,
      detail: r.DetailSpesifikasi || '-',
      nomorSerial: r.NomorSerial || '-',
      jumlah: r.Jumlah || 1,
      bidangPengadaan: r.BidangPengadaan || '-',
      bidangPengguna: r.BidangPengguna || r.Pemilik || '-',
      tanggalPerolehan: r.TanggalPerolehan,
      kondisi: r.Kondisi,
      lokasi: r.Lokasi,
      foto: photoText,
    };

    if (isFormPemeriksaan) {
      rowData.hasilPemeriksaan = ''; // Leave blank for auditor to fill in
      rowData.catatanPemeriksaan = '';
      rowData.tanggalPemeriksaan = '';
    }

    const row = sheet.addRow(rowData);
    applyDataRowStyle(row, idx % 2 === 1);

    row.getCell('assetNumber').numFmt = '@';
    row.getCell('nomorSerial').numFmt = '@';

    if (mainPhoto && mainPhoto.PhotoURL) {
      const cell = row.getCell('foto');
      cell.value = {
        text: `Lihat Foto (${assetPhotos.length})`,
        hyperlink: mainPhoto.PhotoURL.startsWith('http') ? mainPhoto.PhotoURL : `${originUrl}${mainPhoto.PhotoURL}`,
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF2563EB' }, underline: true };
    }
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: records.length + 1, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportDaftarPenarikan(records: DataPenarikan[], photos: FotoInventaris[], originUrl = ''): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BAST & Inventory Asset Management';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Daftar Penarikan Aset', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }],
  });

  sheet.columns = [
    { header: 'No.', key: 'no', width: 6 },
    { header: 'Nomor Inventaris', key: 'assetNumber', width: 24 },
    { header: 'Jenis Barang', key: 'jenisBarang', width: 24 },
    { header: 'Detail / Spesifikasi', key: 'detail', width: 36 },
    { header: 'Nomor Serial', key: 'nomorSerial', width: 20 },
    { header: 'Bidang Pengadaan', key: 'bidangPengadaan', width: 16 },
    { header: 'Bidang Pengguna', key: 'bidangPengguna', width: 16 },
    { header: 'Tanggal Perolehan', key: 'tanggalPerolehan', width: 16 },
    { header: 'Kondisi', key: 'kondisi', width: 16 },
    { header: 'Lokasi Terakhir', key: 'lokasiTerakhir', width: 26 },
    { header: 'Tanggal Penarikan', key: 'tanggalPenarikan', width: 16 },
    { header: 'Alasan Penarikan', key: 'alasanPenarikan', width: 30 },
    { header: 'Catatan', key: 'catatan', width: 34 },
    { header: 'Ditarik Oleh', key: 'ditarikOleh', width: 20 },
    { header: 'Foto', key: 'foto', width: 18 },
  ];

  applyHeaderStyle(sheet.getRow(1));

  records.forEach((r, idx) => {
    const assetPhotos = photos.filter((p) => p.AssetID === r.AssetID);
    const photoText = assetPhotos.length > 0 ? `${assetPhotos.length} Foto` : 'Tidak Ada Foto';
    const mainPhoto = assetPhotos[0];

    const row = sheet.addRow({
      no: idx + 1,
      assetNumber: r.AssetNumber,
      jenisBarang: r.JenisBarang || r.NamaBarang,
      detail: r.DetailSpesifikasi || '-',
      nomorSerial: r.NomorSerial || '-',
      bidangPengadaan: r.BidangPengadaan || '-',
      bidangPengguna: r.BidangPengguna || r.Pemilik || '-',
      tanggalPerolehan: r.TanggalPerolehan,
      kondisi: r.Kondisi,
      lokasiTerakhir: r.LokasiTerakhir,
      tanggalPenarikan: r.TanggalPenarikan,
      alasanPenarikan: r.AlasanPenarikan,
      catatan: r.Catatan || '-',
      ditarikOleh: r.DitarikOleh,
      foto: photoText,
    });

    applyDataRowStyle(row, idx % 2 === 1);

    row.getCell('assetNumber').numFmt = '@';
    row.getCell('nomorSerial').numFmt = '@';

    if (mainPhoto && mainPhoto.PhotoURL) {
      const cell = row.getCell('foto');
      cell.value = {
        text: `Lihat Foto (${assetPhotos.length})`,
        hyperlink: mainPhoto.PhotoURL.startsWith('http') ? mainPhoto.PhotoURL : `${originUrl}${mainPhoto.PhotoURL}`,
      };
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF2563EB' }, underline: true };
    }
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: records.length + 1, column: 14 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
