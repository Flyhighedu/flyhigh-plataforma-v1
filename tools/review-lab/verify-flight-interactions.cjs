const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function verifyFlightInteractions(wc, until) {
  const read = expression => wc.executeJavaScript(expression);
  const altitude = () => read(`parseFloat([...document.querySelectorAll('p')].find(p=>p.textContent==='ALTURA').nextElementSibling.textContent)`);
  const transforms = () => read(`[...document.querySelectorAll('.maplibregl-marker')].map(e=>e.style.transform).join('|')`);
  const originalAltitude = await altitude();
  const scene = await transforms();
  assert.equal(await read(`getComputedStyle(document.querySelector('header')).backgroundImage`), 'none');
  assert.equal(await read(`document.body.innerText.includes('Mapa de calles') || document.body.innerText.includes('Toca y arrastra') || document.body.innerText.includes('Desliza')`), false);
  assert.ok(await read(`document.querySelector('a[href="https://www.openstreetmap.org/copyright"]') !== null`));

  // Real multitouch input, outside the resting circles. A touch is neutral;
  // subsequent drags independently move and climb with pointer capture.
  wc.debugger.attach('1.3');
  const bounds = await read(`({w:innerWidth,h:innerHeight})`);
  const left = { id: 1, x: bounds.w * .25, y: bounds.h * .52 };
  const right = { id: 2, x: bounds.w * .73, y: bounds.h * .52 };
  const touch = (type, touchPoints) => wc.debugger.sendCommand('Input.dispatchTouchEvent', { type, touchPoints });
  await touch('touchStart', [left, right]);
  await delay(350);
  assert.equal(await altitude(), originalAltitude, 'touching either zone must not move the aircraft');
  assert.equal(await transforms(), scene);
  const center = await read(`(() => {const r=document.querySelector('[aria-label="Altura · giro"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  assert.ok(Math.abs(center.x-right.x) < 2 && Math.abs(center.y-right.y) < 2, 'floating joystick centers under the finger');
  await touch('touchMove', [{ ...left, y: left.y - 24 }, { ...right, y: right.y - 24 }]);
  await delay(1200);
  await touch('touchEnd', []);
  await delay(300);
  assert.ok(await altitude() > originalAltitude, 'two fingers can move and climb simultaneously');
  assert.notEqual(await transforms(), scene);
  const stopped = await altitude();
  const stoppedScene = await transforms();
  await delay(300);
  assert.equal(await altitude(), stopped, 'release stops climb');
  assert.equal(await transforms(), stoppedScene, 'release stops horizontal movement');
  console.log('PASS floating controls: neutral placement, simultaneous movement/climb and release');

  // Relative gimbal starts where it is, then reaches a true horizontal camera.
  const gimbal = () => read(`Number(document.querySelector('[role="slider"]').getAttribute('aria-valuenow'))`);
  const slider = await read(`(() => {const r=document.querySelector('[role="slider"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height*.8)};})()`);
  await touch('touchStart', [{ id: 3, ...slider }]);
  await delay(200);
  assert.equal(await gimbal(), -40, 'gimbal must not jump on touch');
  await touch('touchMove', [{ id: 3, x: slider.x, y: slider.y - 65 }]);
  await touch('touchEnd', []);
  console.log('Gimbal:', await gimbal());
  await until(async () => await gimbal() === 0, 'gimbal reaches zero');
  wc.debugger.detach();
  assert.notEqual(await transforms(), stoppedScene, 'zero gimbal changes actual camera projection');
  await read(`document.querySelector('[role="slider"]').focus()`);
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Home' });
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Home' });
  await until(async () => await gimbal() === -90, 'return from horizon to downwards');
  await read(`document.querySelector('[aria-label="Regresar a la escuela"]').click()`);

  const speed = id => read(`(() => {const e=document.querySelector('select[aria-label="Velocidad del ensayo"]');e.value=${JSON.stringify(id)};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`);
  assert.equal(await speed('slow'), 'slow');
  const climb = async () => {
    const p = await read(`(() => {const r=document.querySelector('[aria-label="Altura · giro"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
    const before = await altitude();
    wc.sendInputEvent({ type: 'mouseMove', ...p });
    wc.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y - 35 });
    await delay(1200);
    wc.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
    await delay(300);
    return (await altitude()) - before;
  };
  const slow = await climb();
  await speed('fast');
  const fast = await climb();
  assert.ok(slow > 0 && fast > slow * 1.5, `speed changes movement: slow=${slow}, fast=${fast}`);
  console.log('PASS controls: floating multitouch, neutral touch, release, relative gimbal 0°/-90°, speed selection');

  // Provider responses are fixtures: test success/empty/failure/abort without
  // relying on Overpass availability or mutating any saved narration.
  await read(`(async () => {
    const visit = location.pathname.split('/')[3];
    const preparation = await (await fetch('/api/staff/preparation?visit='+visit)).json();
    const school = preparation.visits[0];
    const original = window.fetch;
    window.__radarRequests=0; window.__radarMode='success';
    window.fetch=async (url, options) => {
      if (!String(url).includes('overpass-api.de')) return original(url,options);
      window.__radarRequests++;
      if (window.__radarMode==='pending') return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
      if (window.__radarMode==='error') return new Response('{}',{status:503});
      return new Response(JSON.stringify({elements:window.__radarMode==='empty'?[]:[{type:'node',id:777,lat:Number(school.ubicacion_lat)+.001,lon:Number(school.ubicacion_lng),tags:{name:'Radar de prueba'}}]}),{headers:{'content-type':'application/json'}});
    };
    return true;
  })()`);
  const radarCount = () => read(`document.querySelectorAll('[data-poi-kind="radar"]').length`);
  const click = label => read(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`);
  await click('Explorar lugares cercanos');
  await until(async () => await radarCount() === 1, 'radar pins added');
  await read(`document.querySelector('[data-poi-kind="radar"]').click()`);
  assert.ok(await read(`document.body.innerText.includes('Radar de prueba')`));
  await click('Ocultar radar de lugares');
  await until(async () => await radarCount() === 0, 'radar pins hidden');
  await click('Explorar lugares cercanos');
  await until(async () => await radarCount() === 1, 'radar pins reused');
  assert.equal(await read('window.__radarRequests'), 1, 'show/hide does not repeat provider queries');
  const refresh = () => read(`document.querySelector('[aria-label="Estado del radar"] button').click()`);
  await read(`window.__radarMode='empty'`); await refresh();
  await until(() => read(`document.body.innerText.includes('Sin lugares adicionales')`), 'empty radar result');
  assert.equal(await radarCount(), 0);
  await read(`window.__radarMode='error'`); await refresh();
  await until(() => read(`document.body.innerText.includes('El radar no respondió')`), 'radar error state');
  await read(`window.__radarMode='pending'`); await refresh();
  await click('Ocultar radar de lugares');
  await delay(200);
  assert.equal(await read(`document.querySelector('[aria-label="Estado del radar"]') === null`), true);
  assert.equal(await read(`window.__flightCanvas === document.querySelector('.maplibregl-canvas')`), true);
  console.log('PASS radar: pins, selection, show/hide, cached results, empty, error and cancellation; same map');
};
