/**
 * Yuma — Script Pengujian Otomatis Bulk Import & Validasi Master Lab (Sprint 4 — S4-Y02)
 *
 * Menguji langsung modul produksi `src/services/bulkImportCore.ts` mencakup:
 * 1. Generator & round-trip `template_laboratorium.csv`
 * 2. Parser CSV (`papaparse`): UTF-8 BOM, quoted comma, escaped quotes, embedded newline,
 *    pemisah titik-koma Excel (`;`), deteksi header hilang/duplikat, kutip rusak, batas >200 baris,
 *    serta peringatan koma desimal tanpa kutip
 * 3. Validator & batas nilai Master Laboratorium (kode A-Z/0-9/-, koordinat, radius 5-5000m,
 *    grace period 0-180 menit integer, denda Rp10.000-Rp50.000 integer, duplikat CSV & existing course)
 * 4. Siklus hidup preview draft: baris kosong/invalid terkunci dari accept, edit memperbaiki baris &
 *    menyelesaikan duplikat lintas baris, tolak manual (deny), kegagalan commit sebagian, dan retry idempotent
 * 5. Kompatibilitas 3 skema independen (Laboratorium Yuma, Praktikan Sela, Asprak Sela)
 */

async function main() {
  const core = await import('../src/services/bulkImportCore.ts');

  const {
    LABORATORY_BULK_HEADERS,
    MAX_BULK_IMPORT_ROWS,
    applyCommitOutcomesToDraftRows,
    buildDeterministicLaboratoryId,
    buildInitialDraftRows,
    buildLaboratoryTemplateCsvContent,
    createLaboratoryBulkRowValidator,
    formatRupiahDisplay,
    generateCsvString,
    getReadyToCommitDraftRows,
    isSameLaboratoryBulkPayload,
    normalizeLaboratoryCell,
    parseCsvContent,
    setDraftRowAcceptance,
    summarizeDraftRows,
    toValidatedLaboratoryBulkPayload,
    updateDraftRowData,
  } = core;

  console.log('=== PENGUJIAN BULK IMPORT & SCHEMA LABORATORIUM (S4-Y02 — YUMA) ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  function run(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed += 1;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err instanceof Error ? err.message : String(err)}`);
      failed += 1;
    }
  }

  // 1. Template Laboratorium round-trip
  run('Template laboratorium memiliki 9 header wajib & lolos validasi penuh', () => {
    const csv = buildLaboratoryTemplateCsvContent();
    const parsed = parseCsvContent(csv, {
      requiredHeaders: LABORATORY_BULK_HEADERS,
      normalizeCell: normalizeLaboratoryCell,
    });
    assert(parsed.ok, 'Template CSV harus berhasil di-parse');
    assert(parsed.rows.length === 2, `Expected 2 sample rows, got ${parsed.rows.length}`);

    const validator = createLaboratoryBulkRowValidator();
    const drafts = buildInitialDraftRows(parsed.rows, validator);
    const summary = summarizeDraftRows(drafts);
    assert(summary.validRows === 2 && summary.invalidRows === 0, 'Seluruh sample row wajib valid');
    assert(summary.readyToCommitRows === 2, 'Seluruh sample row valid otomatis diterima');
    assert(
      drafts[0].data.building === 'Gedung Ilmu Komputer, Sayap Utara',
      'Quoted field dengan koma harus utuh',
    );
  });

  // 2. UTF-8 BOM, quoted newline, escaped quotes
  run('Parser menangani UTF-8 BOM, koma dalam kutip, kutip ganda, dan newline dalam kutip', () => {
    const trickyCsv =
      '\uFEFFlaboratoryCode,name,building,floor,latitude,longitude,radius,gracePeriodMinutes,fineAmount\r\n' +
      'lab-ai-01,"Lab ""AI"" & Robotika","Gedung Riset,\nSayap Timur",4,-7.7705,110.3779,60,10,25000\r\n\r\n';

    const parsed = parseCsvContent(trickyCsv, {
      requiredHeaders: LABORATORY_BULK_HEADERS,
      normalizeCell: normalizeLaboratoryCell,
    });

    assert(parsed.ok, 'CSV kompleks dengan BOM harus berhasil di-parse');
    assert(parsed.rows.length === 1, `Expected 1 data row, got ${parsed.rows.length}`);
    assert(parsed.rows[0].data.laboratoryCode === 'LAB-AI-01', 'Kode lab harus auto-uppercase');
    assert(parsed.rows[0].data.name === 'Lab "AI" & Robotika', 'Escaped quote harus ter-unescape');
    assert(
      parsed.rows[0].data.building.includes('Gedung Riset,') &&
        parsed.rows[0].data.building.includes('Sayap Timur'),
      'Newline di dalam kutip harus dipertahankan dalam satu field',
    );
  });

  // 3. Semicolon delimiter (Indonesian Excel CSV)
  run('Parser mendukung pemisah titik-koma (;) dan desimal koma dari Excel Indonesia', () => {
    const excelSemiCsv = [
      'laboratoryCode;name;building;floor;latitude;longitude;radius;gracePeriodMinutes;fineAmount',
      'LAB-EXCEL-1;Lab Basis Data;Gedung D;1;-7,771234;110,378901;45;0;10000',
    ].join('\r\n');

    const parsed = parseCsvContent(excelSemiCsv, {
      requiredHeaders: LABORATORY_BULK_HEADERS,
      normalizeCell: normalizeLaboratoryCell,
    });
    assert(parsed.ok, 'CSV titik-koma harus berhasil di-parse');
    const validator = createLaboratoryBulkRowValidator();
    const payload = toValidatedLaboratoryBulkPayload(
      'IF202',
      parsed.rows[0].data,
      validator,
    );
    assert(payload !== null, 'Payload dengan desimal koma pada CSV titik-koma harus valid');
    assert(payload.latitude === -7.771234, `Unexpected latitude ${payload.latitude}`);
    assert(payload.gracePeriodMinutes === 0, 'Grace period 0 menit harus diizinkan');
    assert(payload.fineAmount === 10000, 'Denda batas bawah Rp10.000 harus diizinkan');
  });

  // 4. Penolakan file tidak sesuai: kosong, header salah, kutip rusak, > 200 baris
  run('Parser menolak file kosong, header kurang, header duplikat, kutip rusak, dan >200 baris', () => {
    const emptyRes = parseCsvContent('   \uFEFF  \r\n ', {
      requiredHeaders: LABORATORY_BULK_HEADERS,
    });
    assert(!emptyRes.ok && emptyRes.code === 'EMPTY_FILE', 'File kosong harus EMPTY_FILE');

    const headerOnlyRes = parseCsvContent(LABORATORY_BULK_HEADERS.join(',') + '\r\n', {
      requiredHeaders: LABORATORY_BULK_HEADERS,
    });
    assert(!headerOnlyRes.ok && headerOnlyRes.code === 'EMPTY_FILE', 'Header saja harus EMPTY_FILE');

    const wrongHeaderRes = parseCsvContent('laboratoryCode,email,nim\r\nLAB-01,a@b.c,123', {
      requiredHeaders: LABORATORY_BULK_HEADERS,
    });
    assert(
      !wrongHeaderRes.ok &&
        wrongHeaderRes.code === 'MISSING_HEADERS' &&
        wrongHeaderRes.missingHeaders.includes('fineAmount'),
      'File salah template harus ditolak dengan MISSING_HEADERS',
    );

    const dupHeaderRes = parseCsvContent(
      'laboratoryCode,laboratoryCode,name,building,floor,latitude,longitude,radius,gracePeriodMinutes,fineAmount\r\nA,B,C,D,1,0,0,10,5,15000',
      { requiredHeaders: LABORATORY_BULK_HEADERS },
    );
    assert(!dupHeaderRes.ok && dupHeaderRes.code === 'MALFORMED_CSV', 'Header ganda harus ditolak');

    const brokenQuoteRes = parseCsvContent(
      `${LABORATORY_BULK_HEADERS.join(',')}\r\nLAB-01,"Nama tidak ditutup,Gedung,1,-7.7,110.3,50,10,15000`,
      { requiredHeaders: LABORATORY_BULK_HEADERS },
    );
    assert(
      !brokenQuoteRes.ok && brokenQuoteRes.code === 'MALFORMED_CSV',
      'Tanda kutip tidak ditutup harus MALFORMED_CSV',
    );

    const overLimitRows = Array.from({ length: MAX_BULK_IMPORT_ROWS + 1 }, (_, idx) =>
      `LAB-${idx + 1},Lab ${idx + 1},Gedung A,1,-7.77,110.37,50,10,15000`,
    );
    const overLimitCsv = [LABORATORY_BULK_HEADERS.join(','), ...overLimitRows].join('\r\n');
    const overLimitRes = parseCsvContent(overLimitCsv, {
      requiredHeaders: LABORATORY_BULK_HEADERS,
    });
    assert(
      !overLimitRes.ok && overLimitRes.code === 'ROW_LIMIT_EXCEEDED',
      'Lebih dari 200 baris harus ROW_LIMIT_EXCEEDED',
    );
  });

  // 5. Deteksi koma desimal tanpa kutip pada CSV koma (kolom bergeser)
  run('Validator menandai baris yang memiliki kolom berlebih akibat koma desimal tanpa kutip', () => {
    const shiftedCsv = [
      LABORATORY_BULK_HEADERS.join(','),
      'LAB-SHIFT,Lab Geser,Gedung A,2,-7,770615,110,377812,50,10,15000',
    ].join('\r\n');

    const parsed = parseCsvContent(shiftedCsv, {
      requiredHeaders: LABORATORY_BULK_HEADERS,
    });
    assert(parsed.ok, 'File tetap ter-parse agar dapat diperbaiki di preview');
    const validator = createLaboratoryBulkRowValidator();
    const res = validator(parsed.rows[0].data, 0, [parsed.rows[0].data]);
    assert(!res.valid, 'Baris bergeser wajib berstatus invalid');
    assert(
      res.messages.some((m) => m.includes('kolom berlebih')),
      'Pesan harus menjelaskan adanya kolom berlebih',
    );
  });

  // 6. Batas validasi field laboratorium sesuai kesepakatan Yuma
  run('Validator menegakkan batas kode lab, radius (5-5000), grace (0-180), dan denda (Rp10rb-50rb)', () => {
    const validator = createLaboratoryBulkRowValidator({
      existingCodesInCourse: ['LAB-EXISTING'],
    });

    const baseRow = {
      laboratoryCode: 'LAB-OK-01',
      name: 'Lab Uji',
      building: 'Gedung F',
      floor: '2',
      latitude: '-7.7706',
      longitude: '110.3778',
      radius: '50',
      gracePeriodMinutes: '15',
      fineAmount: '50000',
    };

    assert(validator(baseRow, 0, [baseRow]).valid, 'Batas atas denda Rp50.000 harus valid');

    const existingConflict = validator(
      { ...baseRow, laboratoryCode: 'lab-existing' },
      0,
      [{ ...baseRow, laboratoryCode: 'lab-existing' }],
    );
    assert(
      !existingConflict.valid && Boolean(existingConflict.fieldErrors.laboratoryCode),
      'Kode yang sudah terdaftar di mata kuliah harus ditolak (create-only)',
    );

    const fineTooLow = validator(
      { ...baseRow, fineAmount: '5000' },
      0,
      [{ ...baseRow, fineAmount: '5000' }],
    );
    assert(!fineTooLow.valid && Boolean(fineTooLow.fieldErrors.fineAmount), 'Denda < Rp10.000 harus ditolak');

    const fineTooHigh = validator(
      { ...baseRow, fineAmount: '50001' },
      0,
      [{ ...baseRow, fineAmount: '50001' }],
    );
    assert(!fineTooHigh.valid && Boolean(fineTooHigh.fieldErrors.fineAmount), 'Denda > Rp50.000 harus ditolak');

    const graceFloat = validator(
      { ...baseRow, gracePeriodMinutes: '10.5' },
      0,
      [{ ...baseRow, gracePeriodMinutes: '10.5' }],
    );
    assert(!graceFloat.valid && Boolean(graceFloat.fieldErrors.gracePeriodMinutes), 'Grace desimal harus ditolak');

    const graceOver = validator(
      { ...baseRow, gracePeriodMinutes: '181' },
      0,
      [{ ...baseRow, gracePeriodMinutes: '181' }],
    );
    assert(!graceOver.valid, 'Grace > 180 menit harus ditolak');

    const badCode = validator(
      { ...baseRow, laboratoryCode: '---' },
      0,
      [{ ...baseRow, laboratoryCode: '---' }],
    );
    assert(!badCode.valid && Boolean(badCode.fieldErrors.laboratoryCode), 'Kode hanya strip harus ditolak');

    assert(formatRupiahDisplay(15000) === 'Rp15.000', 'Format Rupiah harus konsisten Rp15.000');
  });

  // 7. Alur lengkap Preview: baris kosong, duplikat, edit, deny, partial commit, & retry aman
  run('Alur draft: baris kosong & duplikat tidak bisa disimpan sebelum diedit, deny & partial retry aman', () => {
    const mixedCsv = [
      LABORATORY_BULK_HEADERS.join(','),
      // Baris 1: Valid
      'LAB-01,Lab Satu,Gedung A,1,-7.77,110.37,50,10,15000',
      // Baris 2: Valid tapi akan ditolak manual (deny) oleh Aslab
      'LAB-02,Lab Dua,Gedung A,2,-7.77,110.37,50,10,20000',
      // Baris 3 & 4: Duplikat kode LAB-DUP
      'LAB-DUP,Lab Duplikat A,Gedung B,1,-7.78,110.38,40,5,15000',
      'LAB-DUP,Lab Duplikat B,Gedung B,2,-7.78,110.38,40,5,15000',
      // Baris 5: Seluruh kolom kosong (`,,,,,,,,`)
      ',,,,,,,,',
    ].join('\r\n');

    const parsed = parseCsvContent(mixedCsv, {
      requiredHeaders: LABORATORY_BULK_HEADERS,
      normalizeCell: normalizeLaboratoryCell,
    });
    assert(parsed.ok && parsed.rows.length === 5, 'Harus menghasilkan 5 baris draft');

    const validator = createLaboratoryBulkRowValidator();
    let drafts = buildInitialDraftRows(parsed.rows, validator, 'test');
    let summary = summarizeDraftRows(drafts);

    assert(summary.validRows === 2 && summary.invalidRows === 3, '2 valid, 3 invalid (2 duplikat + 1 kosong)');
    assert(summary.readyToCommitRows === 2, 'Hanya 2 baris valid yang siap disimpan');

    // Mencoba memaksa accept baris kosong (#5) harus gagal (tetap false)
    drafts = setDraftRowAcceptance(drafts, drafts[4].localId, true);
    assert(drafts[4].accepted === false, 'Baris invalid dilarang berubah menjadi accepted');

    // Aslab menolak manual baris #2 (LAB-02)
    drafts = setDraftRowAcceptance(drafts, drafts[1].localId, false);
    summary = summarizeDraftRows(drafts);
    assert(summary.deniedRows === 1 && summary.readyToCommitRows === 1, 'Baris ditolak tidak ikut siap simpan');

    // Aslab mengedit baris #4 dari LAB-DUP menjadi LAB-04 -> otomatis memperbaiki duplikat di baris #3 DAN #4!
    drafts = updateDraftRowData(
      drafts,
      drafts[3].localId,
      { laboratoryCode: 'LAB-04' },
      validator,
    );
    summary = summarizeDraftRows(drafts);
    assert(drafts[2].validation.valid && drafts[3].validation.valid, 'Kedua baris eks-duplikat harus otomatis valid');
    assert(drafts[2].accepted && drafts[3].accepted, 'Baris yang menjadi valid otomatis diterima');
    assert(summary.readyToCommitRows === 3, 'LAB-01, LAB-DUP(#3), dan LAB-04(#4) siap disimpan');

    // Aslab melengkapi baris #5 yang tadinya kosong
    drafts = updateDraftRowData(
      drafts,
      drafts[4].localId,
      {
        laboratoryCode: 'LAB-05',
        name: 'Lab Lima',
        building: 'Gedung C',
        floor: '3',
        latitude: '-7.79',
        longitude: '110.39',
        radius: '30',
        gracePeriodMinutes: '10',
        fineAmount: '25000',
      },
      validator,
    );
    summary = summarizeDraftRows(drafts);
    assert(summary.invalidRows === 0 && summary.readyToCommitRows === 4, '4 baris siap simpan, 1 ditolak (LAB-02)');

    // Simulasi commit pertama: 3 sukses, 1 gagal sebagian (mis. gangguan jaringan di LAB-05)
    const firstBatch = getReadyToCommitDraftRows(drafts);
    assert(firstBatch.length === 4, 'Hanya 4 baris accepted+valid yang dikirim');

    const firstApply = applyCommitOutcomesToDraftRows(drafts, [
      { localId: firstBatch[0].localId, success: true, documentId: 'IF301_LAB-01' },
      { localId: firstBatch[1].localId, success: true, documentId: 'IF301_LAB-DUP' },
      { localId: firstBatch[2].localId, success: true, documentId: 'IF301_LAB-04' },
      { localId: firstBatch[3].localId, success: false, message: 'Timeout jaringan saat menulis dokumen.' },
    ]);
    drafts = firstApply.rows;
    summary = summarizeDraftRows(drafts);

    assert(firstApply.succeededCount === 3 && firstApply.failedCount === 1, '3 sukses, 1 gagal sebagian');
    assert(summary.committedRows === 3 && summary.failedCommitRows === 1, 'Summary mencatat 3 committed & 1 failed');

    // Retry hanya mengirim 1 baris yang gagal (baris yang sudah committed terkunci, baris denied tetap tidak dikirim!)
    const retryBatch = getReadyToCommitDraftRows(drafts);
    assert(
      retryBatch.length === 1 && retryBatch[0].data.laboratoryCode === 'LAB-05',
      'Retry hanya boleh mengirim baris yang gagal, tidak menduplikasi yang sudah sukses',
    );

    // Cek deterministic ID & idempotency helper
    const payload5 = toValidatedLaboratoryBulkPayload('IF301', retryBatch[0].data, validator);
    assert(
      payload5 && payload5.deterministicId === buildDeterministicLaboratoryId('IF301', 'LAB-05'),
      'Deterministic ID harus konsisten IF301_LAB-05',
    );
    assert(
      isSameLaboratoryBulkPayload({ ...payload5 }, payload5),
      'isSameLaboratoryBulkPayload harus mengenali dokumen identik saat retry idempotent',
    );
  });

  // 8. Kompatibilitas 3 jenis format (Laboratorium, Praktikan, Asprak) untuk integrasi Sela
  run('Fondasi generik mendukung skema Praktikan (3 kolom) dan Asprak (2 kolom) milik Sela secara independen', () => {
    const praktikanHeaders = ['laboratoryCode', 'email', 'nim'];
    const asprakHeaders = ['laboratoryCode', 'email'];

    const praktikanCsv = generateCsvString(praktikanHeaders, [
      { laboratoryCode: 'LAB-01', email: 'mhs1@kampus.ac.id', nim: '22001' },
      { laboratoryCode: 'LAB-01', email: 'mhs2@kampus.ac.id', nim: '' },
    ]);
    const parsedPraktikan = parseCsvContent(praktikanCsv, {
      requiredHeaders: praktikanHeaders,
    });
    assert(parsedPraktikan.ok && parsedPraktikan.rows.length === 2, 'Template Praktikan harus ter-parse');

    const validatePraktikan = (row) => {
      const fieldErrors = {};
      const messages = [];
      if (!row.laboratoryCode) fieldErrors.laboratoryCode = 'Kode lab wajib';
      if (!row.email.includes('@')) fieldErrors.email = 'Email tidak valid';
      if (!row.nim) fieldErrors.nim = 'NIM wajib';
      Object.values(fieldErrors).forEach((m) => messages.push(m));
      return { valid: messages.length === 0, fieldErrors, messages };
    };

    const praktikanDrafts = buildInitialDraftRows(parsedPraktikan.rows, validatePraktikan, 'prk');
    assert(
      praktikanDrafts[0].accepted === true && praktikanDrafts[1].accepted === false,
      'Praktikan tanpa NIM harus ditandai invalid & tidak diterima',
    );

    // Pastikan file Asprak (tanpa kolom nim) ditolak bila salah dimasukkan ke menu Praktikan!
    const asprakCsv = generateCsvString(asprakHeaders, [
      { laboratoryCode: 'LAB-01', email: 'asprak1@kampus.ac.id' },
    ]);
    const crossImportCheck = parseCsvContent(asprakCsv, {
      requiredHeaders: praktikanHeaders,
    });
    assert(
      !crossImportCheck.ok && crossImportCheck.code === 'MISSING_HEADERS',
      'File Asprak harus ditolak oleh menu Import Praktikan karena tidak memiliki kolom nim',
    );

    const parsedAsprak = parseCsvContent(asprakCsv, {
      requiredHeaders: asprakHeaders,
    });
    assert(parsedAsprak.ok && parsedAsprak.rows.length === 1, 'Template Asprak harus valid pada menunya sendiri');
  });

  console.log('\n========================================');
  console.log(`TOTAL PENGUJIAN S4-Y02: ${passed + failed}`);
  console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error saat menjalankan test-sprint4-bulk:', err);
  process.exit(1);
});
