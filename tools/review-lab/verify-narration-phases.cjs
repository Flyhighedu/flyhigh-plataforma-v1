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
    const base = { narrative_script: 'Guion General que debe conservarse.', audio_url: 'https://example.org/general.wav', research_article: '# El lugar\n\n' + 'El parque está en Uruapan. Sus manantiales forman el río Cupatitzio y contribuyen al abastecimiento de agua de la comunidad.\n\n'.repeat(18) + 'Fuentes de la búsqueda (verificar los datos en sus páginas):\n- https://example.org/research' };
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
    const labels = { phase_2: 'Preescolar', phase_3: '1.º y 2.º de primaria', phase_4: '3.º y 4.º de primaria', phase_5: '5.º y 6.º de primaria', phase_6: 'Secundaria', general: 'General' };
    const selectVersion = id => evaluate(`document.querySelector('[aria-label="Seleccionar nivel educativo"] button[aria-label="${labels[id]}"]').click(); true;`);
    const editScript = () => evaluate(`document.querySelector('[aria-label="Editar el texto de este guion"]').click(); true;`);
    const closeSaved = async () => { await click('Volver al mapa'); await until(() => evaluate(`!document.querySelector('${dialog}')`), 'saved editor closed'); };
    const openCard = async name => {
        await until(async () => (await body()).includes(name), 'point card');
        await evaluate(`(() => { const e = [...document.querySelectorAll('h3,h4')].find(e => e.textContent.trim() === ${JSON.stringify(name)}); if (!e) throw new Error('Missing card'); e.closest('.cursor-pointer').click(); return true; })()`);
        await until(() => evaluate(`!!document.querySelector('${dialog}')`), 'editor');
        await until(() => evaluate(`document.querySelector('${dialog}').getAnimations().every(a => a.playState === 'finished')`), 'entrance finished');
    };
    const signIn = async (role, pathname) => {
        const response = await fetch(runtime.baseURL + '/api/review-lab/mobile-link', { method: 'POST', headers: { 'content-type': 'application/json', 'x-flyhigh-review-token': runtime.token }, body: JSON.stringify({ role, pathname }) });
        assert.equal(response.status, 200);
        try { await wc.loadURL(runtime.mobileBaseURL + (await response.json()).path); }
        catch (error) { if (error.errno !== -3 || new URL(wc.getURL()).pathname !== pathname) throw error; }
        await until(() => evaluate("document.readyState !== 'loading'"), 'signed-in document');
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
                    if (window.__holdNextScript) { window.__holdNextScript = false; return new Promise((resolve, reject) => { window.__releaseScript = () => resolve(Response.json({ script: 'Guion de prueba para ' + data.phaseId + '.', learning_goal: 'Reconocer el agua.' })); options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); }); }
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
        assert.ok((await body()).includes('Cada lugar tiene algo que contar'));
        assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Versiones por nivel educativo\"] button').length"), 0);
        await installMocks();
        await click('Investigar este lugar');
        await until(async () => (await body()).includes('Completar las 4 versiones faltantes'), 'shared research');
        assert.equal(await evaluate(`document.querySelector('${dialog} textarea') === null`), true);
        assert.ok(!(await body()).includes('Fuentes de la búsqueda'));
        assert.ok(!(await body()).includes('Comprueba los datos'));
        assert.ok(!(await body()).includes('Personalizar portada'));
        for (const width of [320, 390, 1280]) {
            win.setContentSize(width, 844);
            await delay(100);
            const layout = await evaluate(`(() => { const e = document.querySelector('${dialog}'), r = e.getBoundingClientRect(), footer = e.querySelector('footer').getBoundingClientRect(), scroller = e.querySelector('[data-narration-scroll]'); return { fits: r.left >= -1 && r.right <= innerWidth + 1, footer: footer.bottom <= innerHeight + 1, scrollable: scroller.clientHeight > 100 && scroller.scrollHeight > scroller.clientHeight, overflow: e.scrollWidth <= e.clientWidth + 1, nested: [...scroller.querySelectorAll('*')].some(n => ['auto','scroll'].includes(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 2) }; })()`);
            assert.deepEqual(layout, { fits: true, footer: true, scrollable: true, overflow: true, nested: false }, `research layout ${width}`);
        }
        win.setContentSize(390, 844);
        await click('Editar investigación');
        const researchText = await value('research');
        assert.ok(!researchText.includes('https://'));
        await field('research', researchText + ' ');
        assert.equal(await value('research'), researchText + ' ');
        assert.ok(await evaluate(`(() => { const t = document.querySelector('[id$="-research"]'); return t.scrollHeight <= t.clientHeight + 2 && getComputedStyle(t).overflowY === 'hidden'; })()`));
        await click('Terminar edición');
        await evaluate('window.__holdNextScript = true; true;');
        await click('Completar las 4 versiones faltantes');
        await until(() => evaluate('!!window.__releaseScript'), 'held script generation');
        assert.ok((await body()).includes('Tus cinco versiones están tomando forma'));
        assert.ok((await body()).includes('1 de 5 guiones terminados'));
        assert.ok(await evaluate(`!!document.querySelector('${dialog} [aria-label="Generación en curso"] svg')`));
        assert.ok(await evaluate(`document.querySelector('${dialog}').contains(document.activeElement)`));
        wc.debugger.attach('1.3');
        await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        assert.ok(await evaluate(`[...document.querySelectorAll('${dialog} svg g')].every(e => getComputedStyle(e).animationName === 'none')`));
        await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
        wc.debugger.detach();
        await evaluate('window.__releaseScript(); true;');
        await until(async () => (await body()).includes('Completar la versión faltante'), 'partial batch completion');
        assert.ok((await body()).includes('Fallo de prueba recuperable'));
        assert.deepEqual(await evaluate("window.__calls.filter(c => c.endpoint.includes('generate-script')).map(c => c.phase)"), ['phase_2', 'phase_4', 'phase_5', 'phase_6']);
        await click('Completar la versión faltante');
        await until(async () => (await body()).includes('Confirmar guiones y continuar'), 'automatic review');
        assert.deepEqual(await evaluate("window.__calls.filter(c => c.endpoint.includes('generate-script')).map(c => c.phase)"), ['phase_2', 'phase_4', 'phase_5', 'phase_6', 'phase_4']);
        assert.equal(await evaluate("window.__calls.filter(c => c.endpoint.includes('deep-research')).length"), 1);
        assert.equal(await evaluate(`!!document.querySelector('[id$="-script"]')`), false);
        for (const id of ['phase_4', 'phase_5', 'phase_6', 'phase_2']) {
            await selectVersion(id);
            assert.ok((await body()).includes('Confirmar guiones y continuar'));
        }
        win.setContentSize(390, 568);
        await delay(100);
        assert.ok(await evaluate(`(() => { const e = document.querySelector('${dialog}'); return e.querySelector('footer').getBoundingClientRect().bottom <= innerHeight + 1 && e.querySelector('[data-narration-scroll]').clientHeight > 100; })()`));
        win.setContentSize(390, 844);
        assert.ok(!(await body()).includes('Aprobar y continuar'));
        assert.ok(!(await body()).includes('Escribir una versión manualmente'));
        report('PASS: full document, one scroll area at 320/390/1280, expanding editing, hidden bibliography, direct creation, real progress, missing-only retry, free navigation without auto approval');
        await delay(1500);
        const bounds = await evaluate(`(() => { const r = document.querySelector('[aria-roledescription="carrusel"]').getBoundingClientRect(); return { x: r.left + r.width * .75, y: r.top + 32 }; })()`);
        wc.debugger.attach('1.3');
        await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x, y: bounds.y }] });
        for (const dx of [35, 80, 140]) {
            await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x - dx, y: bounds.y }] });
            await delay(25);
        }
        await wc.debugger.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        wc.debugger.detach();
        await until(() => evaluate(`document.querySelector('[aria-label="Seleccionar nivel educativo"] [aria-current="true"]').getAttribute('aria-label') === '1.º y 2.º de primaria'`), 'finger swipe changes the script');
        assert.equal(await evaluate(`!!document.querySelector('[id$="-script"]')`), false);
        report('PASS: real touch drag changes the script without opening its editor');
        await click('Confirmar guiones y continuar');
        await until(async () => (await body()).includes('Voz para cada nivel'), 'single confirmation');
        assert.ok((await body()).includes('Personalizar portada'));
        await click('Crear audios y guardar');
        await until(async () => (await body()).includes('Reintentar pendientes y guardar'), 'partial audio completion');
        assert.ok((await body()).includes('Audio de prueba pendiente'));
        await evaluate(`[...document.querySelectorAll('[aria-label="Pasos para crear narraciones"] button')].find(e => e.textContent.includes('Guiones')).click(); true;`);
        await selectVersion('phase_2');
        await editScript();
        await field('script', 'Guion corregido para preescolar.');
        await field('goal', '');
        await click('Confirmar guiones y continuar');
        assert.ok((await body()).includes('Añade el propósito de aprendizaje'));
        await field('goal', 'Reconocer el agua del lugar.');
        await click('Crear otra propuesta');
        await until(async () => (await body()).includes('Usar esta propuesta'), 'replacement proposal');
        assert.ok(await evaluate(`!!document.querySelector('${dialog} [aria-label="Propuesta de guion"]')`));
        await click('Conservar el anterior');
        assert.ok((await body()).includes('Guion corregido para preescolar.'));
        await click('Crear otra propuesta');
        await until(async () => (await body()).includes('Usar esta propuesta'), 'replacement second proposal');
        await click('Usar esta propuesta');
        assert.ok((await body()).includes('Guion de prueba para phase_2.'));
        assert.ok((await body()).includes('Confirmar guiones y continuar'));
        report('PASS: partial audio recovery, direct text editing invalidates audio, editing requires re-confirmation, replacement is explicit');
        await evaluate(`window.fetch = (url, options) => String(url).includes('/rest/v1/pilot_pois') && options?.method === 'PATCH' ? Promise.resolve(Response.json({ message: 'Fallo simulado de guardado' }, { status: 500 })) : window.__originalFetch(url, options); true;`);
        await click('Guardar borrador');
        await until(async () => (await body()).includes('No se guardaron los cambios'), 'save failure feedback');
        assert.ok((await body()).includes('Guion de prueba para phase_2.'));
        await evaluate('window.fetch = window.__originalFetch; true;');
        await click('Guardar borrador');
        await until(async () => (await body()).includes('Borrador guardado'), 'draft saved');
        await closeSaved();
        const stored = (await client.query('SELECT * FROM pilot_pois WHERE id=$1', [ownId])).rows[0];
        assert.equal(stored.narrative_script, base.narrative_script);
        assert.equal(stored.audio_url, base.audio_url);
        assert.equal(stored.narrative_versions.phase_2.narrative_script, 'Guion de prueba para phase_2.');
        assert.equal(stored.narrative_versions.phase_2.reviewed_at, null);
        assert.equal(stored.narrative_versions.phase_2.audio_url, null);
        assert.equal(stored.narrative_versions.phase_3.audio_url, 'https://example.org/existing.wav');
        assert.equal(stored.narrative_versions.phase_3.reviewed_at, '2026-09-27T00:00:00Z');
        assert.ok(stored.narrative_versions.phase_4.reviewed_at);
        assert.ok(stored.research_article.includes('https://example.org/research'));
        assert.equal(stored.research_article.match(/Fuentes de la búsqueda/g).length, 1);
        assert.equal(Object.keys(stored.narrative_versions).length, 5);
        await openCard(ownName);
        assert.ok((await body()).includes('Confirmar guiones y continuar'));
        assert.ok((await body()).includes('Guion de prueba para phase_2.'));
        await evaluate(`document.querySelector('${dialog} [aria-label="Cerrar editor"]').click(); true;`);
        await until(() => evaluate(`!document.querySelector('${dialog}')`), 'existing editor closed');
        await evaluate(`Array.from(document.querySelectorAll('button')).find(e => e.textContent.includes('AGREGAR TEMA GENERAL')).click(); true;`);
        await field('name', topicName);
        await click('Ya tengo una investigación');
        await field('research', base.research_article);
        await click('Guardar borrador');
        await until(async () => (await body()).includes('Borrador guardado'), 'new topic saved');
        await closeSaved();
        const topic = (await client.query('SELECT * FROM pilot_pois WHERE name=$1 AND user_id=$2', [topicName, user.id])).rows[0];
        assert.ok(topic);
        assert.equal(topic.latitude, null);
        assert.equal(topic.research_article, base.research_article);
        report('PASS: drafts survive save errors, research provenance survives editing, existing General/audio preserved, new topic saves without coordinates');
        await signIn('admin', '/admin/hr-rutas');
        const search = await evaluate(`fetch('/api/staff/map-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'cultural', bounds: { south: 19.412, west: -102.065, north: 19.425, east: -102.050 } }) }).then(async response => ({ status: response.status, data: await response.json() }))`);
        assert.equal(search.status, 200, search.data.error);
        assert.ok(Array.isArray(search.data.elements));
        report('PASS: signed admin queries the real map service (' + search.data.elements.length + ' results)');
        await openCard(officialName);
        assert.ok((await body()).includes('Tu investigación'));
        await installMocks();
        await evaluate('window.__failPhase = false; true;');
        await click('Crear los 5 guiones');
        await until(async () => (await body()).includes('Confirmar guiones y continuar'), 'admin generation');
        await click('Guardar borrador');
        await until(async () => (await body()).includes('Borrador guardado'), 'admin saved');
        await closeSaved();
        const official = (await client.query('SELECT * FROM master_route_pois WHERE id=$1', [officialId])).rows[0];
        assert.equal(official.narrative_script, base.narrative_script);
        assert.equal(official.audio_url, base.audio_url);
        assert.equal(official.research_article, base.research_article);
        assert.equal(Object.keys(official.narrative_versions).length, 5);
        await signIn('pilot', '/staff/narraciones');
        await openCard(officialName);
        await selectVersion('phase_5');
        assert.ok((await body()).includes('Guion de prueba para phase_5.'));
        assert.equal(await evaluate(`!!document.querySelector('${dialog} textarea')`), false);
        assert.ok(!(await body()).includes('Guardar borrador'));
        report('PASS: admin uses the same spacious workflow; official library stays read-only');
        await click('Cerrar');
        await until(() => evaluate(`!document.querySelector('${dialog}')`), 'official read-only closed');
        await openCard(ownName);
        await installMocks();
        await evaluate('window.__failAudio = false; true;');
        await click('Confirmar guiones y continuar');
        await click('Crear audios y guardar');
        await until(async () => (await body()).includes('Narraciones guardadas'), 'automatic final save');
        assert.deepEqual(await evaluate("window.__calls.filter(c => c.endpoint.includes('generate-audio')).map(c => c.phase)"), ['phase_2', 'phase_5']);
        const finished = (await client.query('SELECT narrative_versions FROM pilot_pois WHERE id=$1', [ownId])).rows[0];
        assert.equal(Object.values(finished.narrative_versions).filter(v => v.audio_url).length, 5);
        await closeSaved();
        report('PASS: final action generates only missing audio, persists all five and confirms success');
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
