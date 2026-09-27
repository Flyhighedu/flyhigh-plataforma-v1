// Nonvisual Chromium regression. Creates two local fixtures and removes only those IDs.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { readEnv, validateEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');
app.setName('FlyHigh Phase Regression');
app.setPath('userData', path.join(root, `.review-lab/phase-verification-${process.pid}`));
app.disableHardwareAcceleration();
const report = text => { fs.appendFileSync(path.join(root, '.review-lab/phase-progress.log'), text + '\n'); console.log(text); };
report('Starting nonvisual phase regression');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
    for (let i = 0; i < 120; i++) { if (await check()) return; await delay(500); }
    throw new Error('Timeout: ' + label);
}

app.whenReady().then(async () => {
    report('Chromium ready');
    const input = readEnv(path.join(root, '.env.review.local'));
    validateEnvironment(input, readEnv(path.join(root, '.env.local')));
    const client = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000, query_timeout: 10000 });
    await client.connect();
    report('Local configuration validated');
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.review-lab/runtime.json')));
    const ownId = randomUUID(), officialId = randomUUID();
    const ownName = `Prueba fases ${ownId.slice(0, 8)}`, officialName = `Prueba oficial ${officialId.slice(0, 8)}`;
    const topicName = `Tema de prueba ${ownId}`;
    const base = { narrative_script: 'Guion General que debe conservarse.', audio_url: 'https://example.org/general.wav', research_article: 'El parque está en Uruapan. Sus manantiales forman el río Cupatitzio y contribuyen al abastecimiento de agua de la comunidad. Fuente: CONANP.' };
    const win = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { partition: `phase-${Date.now()}`, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    const wc = win.webContents;
    report('Hidden window created');
    wc.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    const evaluate = code => wc.executeJavaScript(code);
    const body = () => evaluate('document.body.innerText');
    const dialog = '[aria-label="Editor de narraciones por nivel educativo"]';
    const click = text => evaluate(`(() => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)}); if (!e || e.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(text)}); e.click(); return true; })()`);
    const field = (suffix, value) => evaluate(`(() => { const e = document.querySelector('[id$="-${suffix}"]'); Object.getOwnPropertyDescriptor(e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    const value = suffix => evaluate(`document.querySelector('[id$="-${suffix}"]').value`);
    const phase = index => evaluate(`document.querySelectorAll('[aria-label="Versiones por nivel educativo"] button')[${index}].click(); true;`);
    const openCard = async name => {
        await until(async () => (await body()).includes(name), 'point card');
        await evaluate(`(() => { const e = [...document.querySelectorAll('h3,h4')].find(e => e.textContent.trim() === ${JSON.stringify(name)}); if (!e) throw new Error('Missing card'); e.closest('.cursor-pointer').click(); return true; })()`);
        await until(() => evaluate(`!!document.querySelector('${dialog}')`), 'editor');
    };
    const signIn = async (role, pathname) => {
        const response = await fetch(runtime.baseURL + '/api/review-lab/mobile-link', { method: 'POST', headers: { 'content-type': 'application/json', 'x-flyhigh-review-token': runtime.token }, body: JSON.stringify({ role, pathname }) });
        assert.equal(response.status, 200);
        await wc.loadURL(runtime.mobileBaseURL + (await response.json()).path);
    };
    const timer = setTimeout(() => { console.error('Regression exceeded 240 seconds'); app.exit(1); }, 240000);
    try {
        const users = (await client.query('SELECT id,email FROM auth.users')).rows;
        report('Local test identity loaded');
        const user = users.find(item => item.email === 'piloto@revision.flyhigh.test');
        assert.ok(user);
        const route = (await client.query('SELECT id FROM master_routes WHERE title=$1', ['Directorio Global'])).rows[0];
        await client.query('INSERT INTO pilot_pois(id,user_id,name,latitude,longitude,is_general_topic,narrative_script,audio_url,research_article) VALUES($1,$2,$3,19.42,-102.07,false,$4,$5,$6)', [ownId,user.id,ownName,base.narrative_script,base.audio_url,base.research_article]);
        await client.query('INSERT INTO master_route_pois(id,route_id,name,is_general_topic,narrative_script,audio_url,research_article) VALUES($1,$2,$3,true,$4,$5,$6)', [officialId,route.id,officialName,base.narrative_script,base.audio_url,base.research_article]);
        report('Local fixtures created');
        await client.query('UPDATE pilot_pois SET research_article=NULL, narrative_versions=$2 WHERE id=$1', [ownId, JSON.stringify({ phase_3: { narrative_script: 'Guion existente de primaria.', learning_goal: 'Reconocer el agua.', curriculum_focus: 'context', custom_instructions: '', review_note: '', reviewed_at: '2026-09-27T00:00:00Z', audio_url: 'https://example.org/existing.wav', audio_duration_seconds: 15, audio_generated_at: null } })]);
        const installMocks = () => evaluate(`(() => {
            window.__originalFetch = window.fetch;
            window.__calls = []; window.__failPhase = true; window.__failAudio = true;
            window.fetch = (url, options) => {
                const endpoint = String(url);
                if (!endpoint.includes('/api/poi-')) return window.__originalFetch(url, options);
                const data = JSON.parse(options.body); window.__calls.push({ endpoint, phase: data.phaseId });
                if (endpoint.includes('deep-research')) return Promise.resolve(Response.json({ article: ${JSON.stringify(base.research_article)} }));
                if (endpoint.includes('generate-script')) {
                    if (data.phaseId === 'phase_4' && window.__failPhase) { window.__failPhase = false; return Promise.resolve(Response.json({ error: 'Fallo de prueba recuperable' }, { status: 503 })); }
                    return Promise.resolve(Response.json({ script: 'Guion de prueba para ' + data.phaseId + '.', learning_goal: 'Reconocer el agua y cuidar el lugar.', review_note: 'Verificar datos antes de aprobar.' }));
                }
                if (endpoint.includes('generate-audio')) {
                    if (data.phaseId === 'phase_5' && window.__failAudio) { window.__failAudio = false; return Promise.resolve(Response.json({ error: 'Audio de prueba pendiente' }, { status: 503 })); }
                    return Promise.resolve(Response.json({ audio_url: 'https://example.org/' + data.phaseId + '.wav', audio_duration_seconds: 17 }));
                }
                return window.__originalFetch(url, options);
            }; return true;
        })()`);
        await signIn('pilot', '/staff/narraciones');
        await openCard(ownName);
        assert.ok((await body()).includes('Todo empieza con una buena investigación'));
        assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Versiones por nivel educativo\"] button').length"), 0);
        await installMocks();
        await click('Investigar este lugar');
        await until(async () => (await body()).includes('Usar esta investigación y continuar'), 'shared research');
        assert.equal(await value('research'), base.research_article);
        await click('Usar esta investigación y continuar');
        for (const width of [320, 390, 1280]) {
            win.setContentSize(width, 844);
            await delay(100);
            const layout = await evaluate(`(() => { const e = document.querySelector('${dialog}'), r = e.getBoundingClientRect(), footer = e.querySelector('footer').getBoundingClientRect(), scroller = e.children[1]; return { fits: r.left >= -1 && r.right <= innerWidth + 1, footer: footer.bottom <= innerHeight + 1, scrollable: scroller.clientHeight > 100 && scroller.scrollHeight > scroller.clientHeight, overflow: e.scrollWidth <= e.clientWidth + 1 }; })()`);
            assert.deepEqual(layout, { fits: true, footer: true, scrollable: true, overflow: true }, `layout ${width}`);
        }
        win.setContentSize(390, 844);
        await click('Crear las 4 versiones faltantes');
        await until(async () => (await body()).includes('Crear la versión faltante'), 'partial batch completion');
        assert.ok((await body()).includes('Fallo de prueba recuperable'));
        assert.deepEqual(await evaluate("window.__calls.filter(c => c.endpoint.includes('generate-script')).map(c => c.phase)"), ['phase_2', 'phase_4', 'phase_5', 'phase_6']);
        await click('Crear la versión faltante');
        await until(async () => (await body()).includes('Revisa un guion a la vez'), 'automatic review');
        assert.deepEqual(await evaluate("window.__calls.filter(c => c.endpoint.includes('generate-script')).map(c => c.phase)"), ['phase_2', 'phase_4', 'phase_5', 'phase_6', 'phase_4']);
        assert.equal(await evaluate("window.__calls.filter(c => c.endpoint.includes('deep-research')).length"), 1);
        report('PASS: research first, no audience question, generate missing only, partial failure and retry, 320/390/1280 layout');
        for (let i = 0; i < 3; i++) await click('Aprobar y continuar');
        await click('Aprobar y ver audios');
        await until(async () => (await body()).includes('Dales voz a tus guiones'), 'audio step');
        await click('Generar los 4 audios pendientes');
        await until(async () => (await body()).includes('Generar el audio pendiente'), 'partial audio completion');
        assert.ok((await body()).includes('Audio de prueba pendiente'));
        await click('Generar el audio pendiente');
        await until(async () => (await body()).includes('Guardar y terminar'), 'audio retry complete');
        assert.deepEqual(await evaluate("window.__calls.filter(c => c.endpoint.includes('generate-audio')).map(c => c.phase)"), ['phase_2', 'phase_4', 'phase_5', 'phase_6', 'phase_5']);
        await click('Revisar guion');
        await field('script', 'Guion corregido para preescolar.');
        assert.equal(await evaluate(`document.querySelector('${dialog} [aria-label="Audio de esta versión"]') === null`), true);
        await evaluate(`document.querySelector('${dialog} summary').parentElement.open = true; true;`);
        await evaluate(`Array.from(document.querySelectorAll('${dialog} summary')).find(e => e.textContent.includes('Ajustar el enfoque')).parentElement.open = true; true;`);
        await click('Crear otra propuesta');
        await until(async () => (await body()).includes('Usar esta propuesta'), 'replacement proposal');
        assert.equal(await value('script'), 'Guion corregido para preescolar.');
        await click('Usar esta propuesta');
        assert.equal(await value('script'), 'Guion de prueba para phase_2.');
        report('PASS: review sequence, missing audio batch and retry, existing audio retained, script editing invalidates audio, replacement requires acceptance');
        await evaluate(`window.fetch = (url, options) => String(url).includes('/rest/v1/pilot_pois') && options?.method === 'PATCH' ? Promise.resolve(Response.json({ message: 'Fallo simulado de guardado' }, { status: 500 })) : window.__originalFetch(url, options); true;`);
        await click('Guardar borrador y salir');
        await until(async () => (await body()).includes('No se guardaron los cambios'), 'save failure feedback');
        assert.equal(await value('script'), 'Guion de prueba para phase_2.');
        await evaluate('window.fetch = window.__originalFetch; true;');
        await click('Guardar borrador y salir');
        await until(() => evaluate(`!document.querySelector('${dialog}')`), 'save and close');
        const stored = (await client.query('SELECT * FROM pilot_pois WHERE id=$1', [ownId])).rows[0];
        assert.equal(stored.narrative_script, base.narrative_script);
        assert.equal(stored.audio_url, base.audio_url);
        assert.equal(stored.narrative_versions.phase_2.narrative_script, 'Guion de prueba para phase_2.');
        assert.equal(stored.narrative_versions.phase_2.reviewed_at, null);
        assert.equal(stored.narrative_versions.phase_2.audio_url, null);
        assert.equal(stored.narrative_versions.phase_3.audio_url, 'https://example.org/existing.wav');
        assert.equal(Object.keys(stored.narrative_versions).length, 5);
        await openCard(ownName);
        assert.ok((await body()).includes('Revisa un guion a la vez'));
        assert.equal(await value('script'), 'Guion de prueba para phase_2.');
        await evaluate(`document.querySelector('${dialog} [aria-label="Cerrar editor"]').click(); true;`);
        await evaluate(`Array.from(document.querySelectorAll('button')).find(e => e.textContent.includes('AGREGAR TEMA GENERAL')).click(); true;`);
        await field('name', topicName);
        await click('Ya tengo una investigación');
        await field('research', base.research_article);
        await click('Guardar borrador y salir');
        await until(() => evaluate(`!document.querySelector('${dialog}')`), 'research-only new topic save');
        const topic = (await client.query('SELECT * FROM pilot_pois WHERE name=$1 AND user_id=$2', [topicName, user.id])).rows[0];
        assert.ok(topic);
        assert.equal(topic.latitude, null);
        assert.equal(topic.research_article, base.research_article);
        report('PASS: drafts survive save errors, save/reopen restores review, General preserved, research-only topic saves without coordinates');
        await signIn('admin', '/admin/hr-rutas');
        await openCard(officialName);
        assert.ok((await body()).includes('Un lugar. Cinco formas de contarlo.'));
        await installMocks();
        await evaluate('window.__failPhase = false; true;');
        await click('Crear los 5 guiones');
        await until(async () => (await body()).includes('Revisa un guion a la vez'), 'admin generation');
        await click('Guardar borrador y salir');
        await until(() => evaluate(`!document.querySelector('${dialog}')`), 'admin save');
        const official = (await client.query('SELECT * FROM master_route_pois WHERE id=$1', [officialId])).rows[0];
        assert.equal(official.narrative_script, base.narrative_script);
        assert.equal(official.audio_url, base.audio_url);
        assert.equal(official.research_article, base.research_article);
        assert.equal(Object.keys(official.narrative_versions).length, 5);
        await signIn('pilot', '/staff/narraciones');
        await openCard(officialName);
        await phase(4);
        assert.ok((await body()).includes('Guion de prueba para phase_5.'));
        assert.equal(await evaluate(`!!document.querySelector('${dialog} textarea')`), false);
        assert.ok(!(await body()).includes('Guardar borrador y salir'));
        report('PASS: admin uses same guided workflow; official library remains read-only for pilots');
    } catch (error) {
        console.error('Regression error:', error);
        if (wc.getURL()) console.error('Regression state:', (await body()).slice(-3500));
        throw error;
    } finally {
        clearTimeout(timer);
        await client.query('DELETE FROM pilot_pois WHERE id=$1', [ownId]);
        await client.query('DELETE FROM master_route_pois WHERE id=$1', [officialId]);
        await client.query('DELETE FROM pilot_pois WHERE name=$1', [topicName]);
        await client.end();
        win.destroy();
    }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
