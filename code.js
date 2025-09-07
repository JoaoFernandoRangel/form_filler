/* ===================== UI FLOTANTE ===================== */
GM_addStyle(`
    #tm-fill-panel{position:fixed;right:14px;bottom:14px;z-index:999999;background:#111827;color:#e5e7eb;
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu; border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,.35);
      width: 400px; padding:12px}
    #tm-fill-panel *{box-sizing:border-box;font-size:13px}
    #tm-fill-panel h3{margin:0 0 8px;font-size:14px}
    #tm-fill-panel .row{display:flex;gap:8px;align-items:center;margin:6px 0}
    #tm-fill-panel input[type="number"]{width:90px;padding:6px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#e5e7eb}
    #tm-fill-panel input[type="file"]{flex:1}
    #tm-fill-panel button{padding:8px 10px;border:0;border-radius:10px;background:#2563eb;color:#fff;cursor:pointer}
    #tm-fill-panel button.secondary{background:#374151}
    #tm-fill-panel .muted{color:#9ca3af;font-size:12px;margin-top:2px}
    #tm-fill-panel label.chk{display:flex;align-items:center;gap:6px;cursor:pointer}
    #tm-fill-status{margin-top:6px;font-size:12px;color:#a7f3d0}
    #tm-fill-error{margin-top:6px;font-size:12px;color:#fecaca}
    #tm-fill-panel .spacer{height:6px;border-bottom:1px dashed #374151;margin:8px 0}
  `);

const panel = document.createElement('div');
panel.id = 'tm-fill-panel';
panel.innerHTML = `
  <h3>Preencher Form (CSV)</h3>
  <div class="row">
    <input id="tm-file" type="file" accept=".csv" />
  </div>
  <div class="row">
    <label class="chk"><input id="tm-autotime-1" type="checkbox"/> Horário 07:00 às 10:00</label>
  </div>
  <div class="row">
    <label class="chk"><input id="tm-autotime-2" type="checkbox"/> Horário 11:00 às 14:00</label>
  </div>
  <div class="row">
    <label class="chk"><input id="tm-autotime-3" type="checkbox"/> Horário 15:00 às 18:00</label>
  </div>
  <div class="row">
    <label class="chk"><input id="tm-autotime-4" type="checkbox"/> Horário 19:00 às 22:00</label>
  </div>
  <div class="row">
    <label class="chk"><input id="tm-hosp" type="checkbox" checked/> Marcar Hospital Estadual de Diadema</label>
  </div>
  <div class="row">
    <label class="chk"><input id="tm-nonequip" type="checkbox"/> Marcar equipamentos como "Nenhum:"</label>
  </div>
  <div class="spacer"></div>
  <div class="row">
    <label>Linha:</label>
    <input id="tm-line" type="number" min="1" value="1"/>
    <button id="tm-fill">Preencher</button>
    <button id="tm-next" class="secondary">Próx.</button>
  </div>
  <div class="row">
    <button id="tm-export" class="secondary" title="Baixar um CSV com a coluna 'submetida'">
      Exportar CSV com "submetida"
    </button>
  </div>
  <div id="tm-fill-status"></div>
  <div id="tm-fill-error"></div>
  <div class="muted">Campos mapeados: Data, Nome→Iniciais, Idade (anos), Código, Cirurgião, Preceptor, Observador.</div>
  `;

document.documentElement.appendChild(panel);

const els = {
    file: panel.querySelector('#tm-file'),
    line: panel.querySelector('#tm-line'),
    fillBtn: panel.querySelector('#tm-fill'),
    nextBtn: panel.querySelector('#tm-next'),
    exportBtn: panel.querySelector('#tm-export'),
    status: panel.querySelector('#tm-fill-status'),
    error: panel.querySelector('#tm-fill-error'),
    autoTimes: [
        panel.querySelector('#tm-autotime-1'),
        panel.querySelector('#tm-autotime-2'),
        panel.querySelector('#tm-autotime-3'),
        panel.querySelector('#tm-autotime-4')
    ],
    hospital: panel.querySelector('#tm-hosp'),
    nonequip: panel.querySelector('#tm-nonequip'),
};


/* ===================== CSV PARSER ===================== */
function parseCSV(csvText) {
    // robusto o suficiente p/ campos com aspas e vírgulas
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    const pushCell = () => { row.push(cell); cell = ''; };
    const pushRow = () => { rows.push(row); row = []; };

    for (let i = 0; i < csvText.length; i++) {
        const c = csvText[i], n = csvText[i + 1];
        if (inQuotes) {
            if (c === '"' && n === '"') { cell += '"'; i++; }
            else if (c === '"') { inQuotes = false; }
            else { cell += c; }
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') pushCell();
            else if (c === '\r') { /* ignore CR */ }
            else if (c === '\n') { pushCell(); pushRow(); }
            else { cell += c; }
        }
    }
    // última célula/linha
    pushCell();
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) pushRow();

    const header = rows.shift();
    const data = rows.map(r => {
        const obj = {};
        header.forEach((h, idx) => obj[h.trim()] = (r[idx] || '').trim());
        return obj;
    });
    return { header, data };
}

/* ===================== HELPERS DE FORM ===================== */
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function setInputValue(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (el.blur) el.blur();
    return true;
}

function selectByText(selector, text) {
    const el = document.querySelector(selector);
    if (!el) return false;
    const t = norm(text);
    if (!t) return true; // nada para selecionar, considere OK
    // match exato
    for (const opt of el.options) {
        if (norm(opt.textContent) === t) {
            el.value = opt.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    // contém
    for (const opt of el.options) {
        if (norm(opt.textContent).includes(t)) {
            el.value = opt.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    return false;
}

function selectByValue(selector, value) {
    const el = document.querySelector(selector);
    if (!el) return false;
    if ([...el.options].some(o => o.value == value)) {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }
    return false;
}

function selectMultipleByValues(selector, values = []) {
    const el = document.querySelector(selector);
    if (!el) return false;
    const valSet = new Set(values.map(String));
    let any = false;
    for (const opt of el.options) {
        opt.selected = valSet.has(String(opt.value));
        any = any || opt.selected;
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return any;
}

function initialsFromName(name) {
    const skip = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
    const parts = (name || '').trim().split(/\s+/).filter(p => !skip.has(norm(p)));
    const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 6);
    return initials || '';
}

// pega campo (tenta variações sem acentos)
function getCol(row, ...keys) {
    for (const k of keys) {
        if (k in row) return row[k];
    }
    // tenta normalizar chaves
    const map = {};
    for (const key of Object.keys(row)) {
        map[norm(key)] = key;
    }
    for (const k of keys) {
        const nk = norm(k);
        if (nk in map) return row[map[nk]];
    }
    return '';
}

/* ===================== ESTADO DO CSV ===================== */
let CSV = { header: [], data: [] };
let submitted = []; // boolean por linha (base 1)
let fileName = '/home/joao/dev/scripts_lmr/form_filler/cir-diadema.csv';

els.file.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    fileName = f.name || '/home/joao/dev/scripts_lmr/form_filler/cir-diadema.csv';
    const reader = new FileReader();
    reader.onload = () => {
        const txt = String(reader.result || '');
        CSV = parseCSV(txt);
        // garante coluna submetida
        submitted = Array(CSV.data.length + 1).fill(false);
        els.status.textContent = `CSV carregado: ${CSV.data.length} linhas`;
        els.error.textContent = '';
        // tenta posicionar na 1ª não submetida
        els.line.value = '1';
    };
    reader.readAsText(f, 'utf-8');
});

function fillCurrentLine() {
    els.status.textContent = '';
    els.error.textContent = '';
    const idx = Math.max(1, parseInt(els.line.value || '1', 10));
    const row = CSV.data[idx - 1];
    if (!row) {
        els.error.textContent = 'Linha inexistente no CSV.';
        return;
    }

    // Campos do CSV (pelos nomes que você passou)
    const Data = getCol(row, 'Data');
    const Nome = getCol(row, 'Nome');
    const Idade = getCol(row, 'Idade');
    const Codigo = getCol(row, 'Codigo', 'Código', 'Cod', 'Prontuario', 'Prontuário');
    const Preceptor = getCol(row, 'Preceptor');
    const Cirurgiao = getCol(row, 'Cirurgião', 'Cirurgiao', 'Cirurgiã');
    const Observador = getCol(row, 'Observador');
    const Procedimento = getCol(row, 'Procedimento');

    // ======= PREENCHIMENTO =======
    const results = [];

    // Datas (usa mesma Data p/ início e conclusão)
    results.push(['startDate', setInputValue("input[name='startDate']", Data)]);
    results.push(['finalDate', setInputValue("input[name='finalDate']", Data)]);

    // Horários opcionais (se marcado)
    if (els.autoTimes[0].checked) {
        results.push(['startTime', selectByText("select[name='startTime']", "07:00 às 07:30")]);
        results.push(['finalTime', selectByText("select[name='finalTime']", "10:00 às 10:30")]);
    }
    if (els.autoTimes[1].checked) {
        results.push(['startTime', selectByText("select[name='startTime']", "11:00 às 11:30")]);
        results.push(['finalTime', selectByText("select[name='finalTime']", "14:00 às 14:30")]);
    }
    if (els.autoTimes[2].checked) {
        results.push(['startTime', selectByText("select[name='startTime']", "15:00 às 15:30")]);
        results.push(['finalTime', selectByText("select[name='finalTime']", "18:00 às 18:30")]);
    }
    if (els.autoTimes[3].checked) {
        results.push(['startTime', selectByText("select[name='startTime']", "19:00 às 19:30")]);
        results.push(['finalTime', selectByText("select[name='finalTime']", "22:00 às 22:30")]);
    }

    // Hospital Auxiliar (se marcado)
    if (els.hospital.checked) {
        results.push(['hospitalAux', selectByText("select[name='hospitalAux']", "Hospital Estadual de Diadema")]);
    }

    // Equipamentos "Nenhum:" opcional (value=82)
    if (els.nonequip.checked) {
        results.push(['equipaments[]', selectMultipleByValues("select[name='equipaments[]']", ['82'])]);
    }

    // Paciente
    const iniciais = initialsFromName(Nome);
    results.push(['patientsInitials', setInputValue("input[name='patientsInitials']", iniciais)]);
    results.push(['ageOfThePatient', setInputValue("input[name='ageOfThePatient']", String(Idade || '').replace(/\D/g, ''))]);
    // Unidade de tempo = Anos (value 92)
    const ageTypeOk = selectByValue("select[name='ageType']", '92') || selectByText("select[name='ageType']", 'Anos');
    results.push(['ageType', ageTypeOk]);
    results.push(['patientsChartNumber', setInputValue("input[name='patientsChartNumber']", Codigo)]);

    // Participantes
    results.push(['surgeon', selectByText("select[name='surgeon']", Cirurgiao)]);
    results.push(['preceptor', selectByText("select[name='preceptor']", Preceptor)]);
    if ((Observador || '').trim()) {
        results.push(['observer', selectByText("select[name='observer']", Observador)]);
    }

    // Procedimento (deixa para revisão humana: não arriscar mapeamento clínico incorreto)
    // Dica: se quiser ligar um chute seguro, coloque palavras-chave aqui e selecione o "procedureGroup".
    // Ex.: if (norm(Procedimento).includes('coluna')) selectByValue("select[name='procedureGroup']", '7');

    // ======= AVALIAÇÃO DO SUCESSO =======
    // Consideramos "submetida = True" se TODOS os campos que tentamos preencher (acima) deram certo.
    const allOk = results.every(([k, ok]) => ok !== false);
    submitted[idx] = allOk;

    els.status.textContent = allOk
        ? `✅ Linha ${idx}: preenchida com sucesso. (submetida=True)`
        : `⚠️ Linha ${idx}: algo não foi preenchido (submetida=False). Veja console p/ detalhes.`;

    // Log detalhado
    console.group(`Preenchimento linha ${idx}`);
    console.table(Object.fromEntries(results.map(([k, ok]) => [k, ok])));
    if (!allOk) console.warn('Alguns campos falharam. Revise os seletores/nomes no CSV ou na página.');
    console.groupEnd();
}

els.fillBtn.addEventListener('click', fillCurrentLine);
els.nextBtn.addEventListener('click', () => {
    fillCurrentLine();
    const cur = Math.max(1, parseInt(els.line.value || '1', 10));
    const total = CSV.data.length;
    if (cur < total) els.line.value = String(cur + 1);
});

// Exporta CSV com coluna "submetida"
els.exportBtn.addEventListener('click', () => {
    if (!CSV.data.length) {
        els.error.textContent = 'Carregue um CSV primeiro.';
        return;
    }
    const header = [...CSV.header];
    if (!header.map(h => norm(h)).includes('submetida')) header.push('submetida');

    const lines = [];
    lines.push(header.join(','));

    for (let i = 0; i < CSV.data.length; i++) {
        const row = CSV.data[i];
        const lineObj = {};
        header.forEach(h => { lineObj[h] = (h in row) ? row[h] : ''; });

        // escreve submetida como True/False
        lineObj['submetida'] = submitted[i + 1] ? 'True' : 'False';

        // csv escape
        const cells = header.map(h => {
            const v = (lineObj[h] ?? '').toString();
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        });
        lines.push(cells.join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = fileName.replace(/\.csv$/i, '');
    a.download = `${base}-com-submetida.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
});