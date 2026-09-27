const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = async (wc, until) => {
  const read = code => wc.executeJavaScript(code);
  await until(() => read(`!!document.querySelector('[aria-label="Mapa de despegue"] .leaflet-container[data-center]')`), 'normal takeoff map');
  assert.equal(await read(`document.querySelectorAll('[role="application"]').length`), 0);
  const state = () => read(`(()=>{const e=document.querySelector('[aria-label="Mapa de despegue"] .leaflet-container');return {center:e.dataset.center,zoom:e.dataset.zoom}})()`);
  const before = await state();
  const bounds = await read('({w:innerWidth,h:innerHeight})');
  wc.debugger.attach('1.3');
  const touch = (type, touchPoints) => wc.debugger.sendCommand('Input.dispatchTouchEvent', { type, touchPoints });
  const a = {id:1,x:bounds.w*.45,y:bounds.h*.45};
  await touch('touchStart',[a]);
  for(let n=1;n<=5;n++){await touch('touchMove',[{...a,x:a.x+n*12}]);await delay(35);}
  await touch('touchEnd',[]); await delay(700);
  const panned = await state();
  assert.notEqual(panned.center,before.center,'one finger pans');
  assert.equal(panned.zoom,before.zoom,'one finger does not zoom');
  const b={id:2,x:bounds.w*.65,y:bounds.h*.45};
  await touch('touchStart',[a,b]);
  for(let n=1;n<=5;n++){await touch('touchMove',[{...a,x:a.x-n*9},{...b,x:b.x+n*9}]);await delay(35);}
  await touch('touchEnd',[]); await delay(500);
  assert.notEqual((await state()).zoom,panned.zoom,'two fingers pinch zoom');
  wc.debugger.detach();
  await until(()=>read(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Despegar aquí'&&!b.disabled)`),'takeoff confirmation ready');
  await read(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Despegar aquí').click()`);
  console.log('PASS takeoff: one-finger pan, two-finger pinch, explicit confirmation, no flight controls');
};
