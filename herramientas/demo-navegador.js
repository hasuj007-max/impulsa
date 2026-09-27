/* Siembra datos de ejemplo en la app para probar o enseñarla en el navegador.

   USO: servir con preview_start "impulsa-aislado" (puerto 8799: otro origen,
   sin sesión posible), abrir http://localhost:8799/index.html y pegar TODO este
   archivo en javascript_tool. Deja la app con:
   - racha de ~11 días (con perfectos, trabajados y un par de días flojos),
   - el día de hoy a medias (~52%),
   - 12 prospectos en todas las etapas, con seguimientos atrasados y de hoy,
   - 3 ventas con importe y ganancia, meta del mes y 2 pendientes de agenda.

   Si el navegador sirve una copia vieja del HTML, antes:
     (await navigator.serviceWorker.getRegistrations()).forEach(r=>r.unregister());
     (await caches.keys()).forEach(k=>caches.delete(k)); localStorage.clear();
   y recargar.

   AL TERMINAR: localStorage.clear()  */

window.Nube = null;                              // nada sube a ninguna cuenta
document.getElementById('portada').classList.add('oculto');  // .oculto es !important: basta

const hace = n => { const d = new Date(); d.setDate(d.getDate()-n); return claveDia(d); };
const enDias = n => { const d = new Date(); d.setDate(d.getDate()+n); return claveDia(d); };
// deja un día con el anillo en ~pct%, llenando actividades en orden
const poner = (k, pct) => {
  const d = diaDe(k), act = metasActivas(k);
  act.forEach(m => d[m.id] = 0);
  let resto = pct/100*act.length;
  act.forEach(m => { d[m.id] = Math.round(Math.min(1, Math.max(0, resto))*m.objetivo); resto -= 1; });
};

// historia: mayoría trabajados, algunos perfectos, un par flojos
[20,19,18,16,15,14,12,11,10,9,8,6,5,4,3,2,1].forEach(n => poner(hace(n), [100,90,85,95,88][n%5]));
[17,13].forEach(n => poner(hace(n), 45));
poner(hace(7), 30);

// hoy a medias
Object.assign(diaDe(hoy()), {conv:14, fbgr:25, mkt:25, tiktok:1, addfb:10, segig:38});

// prospectos: [nombre, red, etapa, días al seguimiento (null = sin fecha)]
datos.prospectos = [
  ['María López','Instagram','Cliente',0],       ['Jorge Martínez','Facebook','En conversación',-3],
  ['Ana Ruiz','Marketplace','Interesado',0],     ['Carlos Pérez','Grupo FB','Contactado',-1],
  ['Lucía Sandoval','Referido','Socio',null],    ['Diego Herrera','TikTok','Nuevo',0],
  ['Fernanda Ríos','Instagram','En conversación',2], ['Rodrigo Silva','Facebook','Nuevo',-2],
  ['Karla Méndez','Referido','Cliente',5],       ['Sofía Aguilar','Instagram','Interesado',1],
  ['Paty Gómez','WhatsApp','Descartado',null],   ['Nayeli Pech','TikTok','Nuevo',0]
].map(([nombre, red, etapa, seg], i) => {
  const creado = hace(25-i);
  return { id:'p'+i, nombre, red, etapa,
    contacto: i%2 ? '+52 999 12'+i+' 45'+i : '@'+nombre.split(' ')[0].toLowerCase(),
    fecha: seg===null ? '' : enDias(seg),
    notas: i%3 ? 'Le interesa el ingreso extra.' : '',
    creado, hist: {Nuevo:creado, [etapa]:hace(10-i%5)}, log: [{f:creado, t:'Primer mensaje'}] };
});

// ventas con importe (el CONTEO va en dias[f].venta, como en la app)
[[hace(12),1200,60],[hace(6),850,42.5],[hace(2),2400,120]].forEach(([f,monto,ganancia]) => {
  datos.ventas.push({id:'v'+f, f, monto, ganancia});
  const d = diaDe(f); d.venta = (d.venta||0)+1;
});
diaDe(hace(9)).socio = 1;
datos.metaMes = {ventas:12, socios:3};
datos.agenda = [
  {id:'t1', texto:'Ir por producto a la bodega', hora:'17:00', fecha:hoy(), hecha:false},
  {id:'t2', texto:'Junta de zona',               hora:'20:30', fecha:hoy(), hecha:false}
];
localStorage.setItem('impulsa_guia', GUIA_VERSION);   // que la guía no tape la prueba

guardar(); reacomodarMetas(); repintarTodo(); window.scrollTo(0,0);
'demo lista · racha '+calcularRacha()+' · hoy '+pctDelDia(hoy())+'% · '
  + datos.prospectos.length+' prospectos · '+datos.ventas.length+' ventas';
