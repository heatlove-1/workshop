/* HWPX 생성기 — 검증된 빈 문서(template)의 header/section만 교체해서 hwpx를 만든다.
   브라우저(JSZip 필요)와 Node 양쪽에서 동작. */
(function (root) {
  const xesc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  function maxId(h, tag) {
    let m = 0; const re = new RegExp('<hh:' + tag + ' id="(\\d+)"', 'g'); let r;
    while ((r = re.exec(h))) m = Math.max(m, +r[1]);
    return m;
  }
  function addItems(h, listTag, xmls) {
    const re = new RegExp('(<hh:' + listTag + ' itemCnt=")(\\d+)(")');
    h = h.replace(re, (m, a, n, b) => a + (+n + xmls.length) + b);
    return h.replace('</hh:' + listTag + '>', xmls.join('') + '</hh:' + listTag + '>');
  }

  // 글자(굵게/제목)·문단(가운데)·표 테두리를 header.xml에 추가
  function patchHeader(h) {
    const ids = {};
    // 테두리 있는 borderFill
    const bf2 = h.match(/<hh:borderFill id="2"[\s\S]*?<\/hh:borderFill>/)[0];
    ids.border = maxId(h, 'borderFill') + 1;
    const bf = bf2.replace('id="2"', 'id="' + ids.border + '"')
      .replace(/<hh:(left|right|top|bottom)Border type="NONE" width="0\.1 mm"/g, '<hh:$1Border type="SOLID" width="0.12 mm"');
    h = addItems(h, 'borderFills', [bf]);

    // 글자 모양
    const cp0 = h.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)[0];
    const base = maxId(h, 'charPr') + 1;
    const mk = (id, height, bold) => {
      let x = cp0.replace('id="0"', 'id="' + id + '"').replace('height="1000"', 'height="' + height + '"');
      if (bold) x = x.replace('<hh:underline', '<hh:bold/><hh:underline');
      return x;
    };
    ids.bold = base; ids.title = base + 1; ids.sub = base + 2;
    h = addItems(h, 'charProperties', [mk(ids.bold, 1000, true), mk(ids.title, 1800, true), mk(ids.sub, 1300, true)]);

    // 가운데 정렬 문단
    const pp0 = h.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/)[0];
    ids.center = maxId(h, 'paraPr') + 1;
    const pc = pp0.replace('id="0"', 'id="' + ids.center + '"').replace('horizontal="JUSTIFY"', 'horizontal="CENTER"');
    h = addItems(h, 'paraProperties', [pc]);
    return { header: h, ids };
  }

  function para(runs, o) {
    o = o || {};
    const rs = (runs && runs.length)
      ? runs.map(r => '<hp:run charPrIDRef="' + (r.c != null ? r.c : (r.b ? o.ids.bold : 0)) + '"><hp:t>' + xesc(r.t) + '</hp:t></hp:run>').join('')
      : '<hp:run charPrIDRef="0"><hp:t/></hp:run>';
    return '<hp:p id="0" paraPrIDRef="' + (o.pp || 0) + '" styleIDRef="0" pageBreak="' + (o.pb ? 1 : 0) + '" columnBreak="0" merged="0">' + rs + '</hp:p>';
  }

  let tblSeq = 0;
  function tblXml(rows, ids) {
    const R = rows.length, C = Math.max.apply(null, rows.map(r => r.length).concat([1]));
    const W = 42520, cw = Math.floor(W / C), rh = 2000;
    const bf = ids.border;
    let x = '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">' +
      '<hp:tbl id="' + (900000 + (++tblSeq)) + '" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="' + R + '" colCnt="' + C + '" cellSpacing="0" borderFillIDRef="' + bf + '" noAdjust="0">' +
      '<hp:sz width="' + (cw * C) + '" widthRelTo="ABSOLUTE" height="' + (rh * R) + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>';
    rows.forEach((r, ri) => {
      x += '<hp:tr>';
      for (let ci = 0; ci < C; ci++) {
        const c = r[ci] || { t: '' };
        x += '<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="' + bf + '">' +
          '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' +
          para(c.t ? [{ t: c.t, b: c.b }] : [], { ids }) + '</hp:subList>' +
          '<hp:cellAddr colAddr="' + ci + '" rowAddr="' + ri + '"/><hp:cellSpan colSpan="1" rowSpan="1"/>' +
          '<hp:cellSz width="' + cw + '" height="' + rh + '"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>';
      }
      x += '</hp:tr>';
    });
    x += '</hp:tbl><hp:t/></hp:run></hp:p>';
    return x;
  }

  function blocksXml(blocks, ids) {
    return (blocks || []).map(b => {
      if (b.type === 'tbl') return tblXml(b.rows, ids) + para([], { ids });
      return para(b.runs, { ids });
    }).join('');
  }

  /* data = { title, groups:[{name, members, topic, blocks}] } */
  function buildSections(sectionTpl, ids, data) {
    // 첫 문단(secPr 포함)에 문서 제목을 넣는다
    let sec = sectionTpl;
    sec = sec.replace('<hp:p id="0" paraPrIDRef="0"', '<hp:p id="0" paraPrIDRef="' + ids.center + '"');
    sec = sec.replace('<hp:run charPrIDRef="0"><hp:t/></hp:run>',
      '<hp:run charPrIDRef="' + ids.title + '"><hp:t>' + xesc(data.title) + '</hp:t></hp:run>');
    sec = sec.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/, '');
    let body = para([], { ids });
    data.groups.forEach((g, i) => {
      body += para([{ t: g.name, c: ids.sub }], { ids, pb: i > 0 });
      if (g.members) body += para([{ t: '구성원  ' + g.members }], { ids });
      if (g.topic) body += para([{ t: '주제  ', b: true }, { t: g.topic, b: true }], { ids });
      body += para([], { ids });
      body += blocksXml(g.blocks, ids);
    });
    return sec.replace('</hs:sec>', body + '</hs:sec>');
  }

  async function buildHwpx(JSZipLib, templateB64, data) {
    const zip = await JSZipLib.loadAsync(templateB64, { base64: true });
    const hdr = await zip.file('Contents/header.xml').async('string');
    const sec = await zip.file('Contents/section0.xml').async('string');
    const hpf = await zip.file('Contents/content.hpf').async('string');
    const patched = patchHeader(hdr);
    zip.file('Contents/header.xml', patched.header);
    zip.file('Contents/section0.xml', buildSections(sec, patched.ids, data));
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('Contents/content.hpf', hpf
      .replace('<opf:title/>', '<opf:title>' + xesc(data.title) + '</opf:title>')
      .replace(/synthetic-fixture-author/g, '분임 토론방')
      .replace(/(name="CreatedDate" content="text">)[^<]*/, '$1' + now)
      .replace(/(name="ModifiedDate" content="text">)[^<]*/, '$1' + now));
    zip.file('Preview/PrvText.txt', data.groups.map(g => g.name).join('\n'));
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
    return zip;
  }

  root.HWPX = { buildHwpx, patchHeader, buildSections, xesc };
  if (typeof module !== 'undefined') module.exports = root.HWPX;
})(typeof window !== 'undefined' ? window : globalThis);
