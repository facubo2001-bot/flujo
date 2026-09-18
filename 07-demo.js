/* ===================== FLUJO — demo data ===================== */
function cargarDemo() {
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)]; const between = (a, b) => Math.round(a + rnd() * (b - a));
  const s = defaultState();
  s.settings = { ...s.settings, ingreso: 2900000, presupuesto: 1900000, diaCobro: 1, tc: 1350, alertaCuotasPct: 60, nombre: 'Demo' };
  const visa = { id: 't_visa', nombre: 'Visa', banco: 'Galicia', cierre: 20, vencimiento: 5, limite: 3000000, color: CARD_COLORS[0] };
  const master = { id: 't_master', nombre: 'Mastercard', banco: 'Santander', cierre: 24, vencimiento: 10, limite: 2000000, color: CARD_COLORS[1] };
  s.tarjetas = [visa, master];
  s.cuentas = [{ id: 'a1', nombre: 'Galicia caja de ahorro', tipo: 'Caja de ahorro', saldo: 1850000, moneda: 'ARS', esSueldo: true }, { id: 'a2', nombre: 'Mercado Pago', tipo: 'Billetera virtual', saldo: 320000, moneda: 'ARS' }, { id: 'a3', nombre: 'Balanz', tipo: 'Broker', saldo: 7100, moneda: 'USD' }];
  const hoy = D.today(); const ymNow = D.thisMonth(); const start = D.addMonths(ymNow, -5);
  s.recurrentes = [
    { id: 'r1', desc: 'Alquiler', monto: 520000, moneda: 'ARS', catId: 'alquiler', medio: 'transferencia', dia: 5, necesidad: 1, desde: start },
    { id: 'r2', desc: 'Expensas', monto: 95000, moneda: 'ARS', catId: 'alquiler', medio: 'debito', dia: 10, necesidad: 1, desde: start },
    { id: 'r3', desc: 'Seguro del auto', monto: 78000, moneda: 'ARS', catId: 'auto', medio: 'tarjeta', tarjetaId: 't_visa', dia: 8, necesidad: 1, desde: start },
    { id: 'r4', desc: 'Claude Pro', monto: 20, moneda: 'USD', catId: 'subs', medio: 'tarjeta', tarjetaId: 't_master', dia: 12, necesidad: 2, desde: start },
    { id: 'r5', desc: 'Netflix', monto: 12990, moneda: 'ARS', catId: 'subs', medio: 'tarjeta', tarjetaId: 't_visa', dia: 15, necesidad: 2, desde: start },
    { id: 'r6', desc: 'Spotify', monto: 6500, moneda: 'ARS', catId: 'subs', medio: 'tarjeta', tarjetaId: 't_visa', dia: 3, necesidad: 2, desde: start },
    { id: 'r7', desc: 'Gimnasio Megatlon', monto: 52000, moneda: 'ARS', catId: 'deporte', medio: 'debito', dia: 1, necesidad: 1, desde: start },
    { id: 'r8', desc: 'Personal celular', monto: 19500, moneda: 'ARS', catId: 'servicios', medio: 'debito', dia: 18, necesidad: 1, desde: start },
    { id: 'r9', desc: 'Fibertel', monto: 24000, moneda: 'ARS', catId: 'servicios', medio: 'debito', dia: 20, necesidad: 1, desde: start },
    { id: 'r10', desc: 'Prepaga OSDE', monto: 118000, moneda: 'ARS', catId: 'salud', medio: 'debito', dia: 6, necesidad: 1, desde: start },
  ];
  const movs = [];
  const add = (fecha, desc, monto, catId, medio, tarjetaId, necesidad, cuotas = 1, moneda = 'ARS') => { if (fecha > hoy) return; movs.push({ id: uid(), fecha, desc, monto, moneda, catId, medio, tarjetaId, necesidad, cuotas }); };
  const months = D.range(start, 6);
  months.forEach((ym, mi) => {
    const days = D.daysIn(ym);
    for (let d = 1; d <= days; d++) {
      const f = D.dateIn(ym, d); if (f > hoy) break; const dow = D.dow(f);
      if (dow === 6 || (dow === 3 && rnd() < 0.5)) add(f, pick(['Carrefour', 'Coto', 'Día', 'Jumbo']), between(28000, 70000), 'super', 'tarjeta', 't_visa', 1);
      if (dow === 1 && rnd() < 0.8) add(f, 'YPF', between(35000, 55000), 'nafta', 'tarjeta', 't_master', 1);
      if (rnd() < 0.22) add(f, pick(['Rappi', 'PedidosYa', 'McDonalds', 'Sushi Pop']), between(11000, 28000), 'delivery', 'tarjeta', 't_master', rnd() < 0.5 ? 2 : 3);
      if ((dow === 5 || dow === 6) && rnd() < 0.4) add(f, pick(['Bar Temple', 'Cervecería Antares', 'Cine Hoyts', 'Parrilla Don Julio', 'Previa en lo de Nico']), between(18000, 65000), 'salidas', pick(['tarjeta', 'efectivo', 'transferencia']), 't_visa', rnd() < 0.45 ? 3 : 2);
      if (rnd() < 0.1) add(f, pick(['Farmacity', 'Farmacia Central']), between(6000, 22000), 'salud', 'debito', undefined, 1);
      if (rnd() < 0.12) add(f, pick(['Uber', 'Cabify', 'SUBE']), between(3500, 12000), 'transporte', 'transferencia', undefined, 1);
      if (rnd() < 0.05) add(f, pick(['Kiosco', 'Café Martínez', 'Starbucks']), between(3000, 9000), 'delivery', 'efectivo', undefined, 3);
      if (rnd() < 0.05) add(f, pick(['Mercado Libre', 'Easy', 'Librería']), between(15000, 60000), pick(['hogar', 'tech', 'educacion']), 'tarjeta', 't_master', 2);
      if (rnd() < 0.03) add(f, pick(['Zara', 'Nike Store', 'Dexter']), between(45000, 140000), 'ropa', 'tarjeta', 't_visa', rnd() < 0.5 ? 2 : 3, rnd() < 0.5 ? 3 : 1);
    }
    add(D.dateIn(ym, 12), 'Estacionamiento y peajes', between(20000, 35000), 'auto', 'tarjeta', 't_master', 1);
  });
  // cuotas
  add(D.dateIn(D.addMonths(ymNow, -4), 14), 'Notebook Lenovo (ML)', 1450000, 'tech', 'tarjeta', 't_visa', 2, 12);
  add(D.dateIn(D.addMonths(ymNow, -2), 3), 'Zapatillas Nike', 189000, 'ropa', 'tarjeta', 't_master', 3, 3);
  add(D.dateIn(D.addMonths(ymNow, -1), 22), 'Pasajes a Bariloche (Flybondi)', 640000, 'viajes', 'tarjeta', 't_visa', 2, 6);
  add(D.dateIn(D.addMonths(ymNow, -3), 9), 'Service 20.000 km', 310000, 'auto', 'tarjeta', 't_master', 1, 3);
  add(D.dateIn(ymNow, 2), 'Regalo cumple mamá', 95000, 'regalos', 'tarjeta', 't_visa', 2, 1);
  s.movimientos = movs;
  s.inversiones = months.filter(m => m < ymNow).map(m => ({ id: uid(), fecha: D.dateIn(m, 3), monto: between(400, 700), moneda: 'USD', destino: 'Balanz', desc: 'CEDEARs / ONs' }));
  s.inversiones.push({ id: uid(), fecha: D.dateIn(D.addMonths(ymNow, -1), 15), monto: 150000, moneda: 'ARS', destino: 'BTC', desc: 'Compra mensual' });
  const jun = months.find(m => m.endsWith('-06') || m.endsWith('-12')); if (jun) s.ingresos.push({ id: uid(), fecha: D.dateIn(jun, 30), monto: 1150000, moneda: 'ARS', desc: 'Aguinaldo' });
  s.categorias.find(c => c.id === 'delivery').presupuesto = 120000; s.categorias.find(c => c.id === 'salidas').presupuesto = 180000; s.categorias.find(c => c.id === 'super').presupuesto = 400000;
  s.pagos = [{ tarjetaId: 't_visa', mes: ymNow, cuentaId: 'a1', pagado: true }, { tarjetaId: 't_master', mes: ymNow, cuentaId: 'a1', pagado: false }];
  state = s; state.updatedAt = Date.now();
}
