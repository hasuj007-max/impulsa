#!/bin/bash
# Mira cómo estaba la cuenta de alguien en un momento de la ÚLTIMA HORA.
#
#   bash herramientas/rescatar.sh correo@ejemplo.com            # línea de tiempo
#   bash herramientas/rescatar.sh correo@ejemplo.com 18:58:30   # guarda esa versión
#
# Firestore conserva 1 hora de versiones aunque la recuperación a un punto en el
# tiempo esté apagada (plan gratuito). Pasada esa hora, lo único que queda es lo
# que haya guardado respaldar.sh. La hora se escribe en UTC.
#
# Este script SOLO LEE y guarda en respaldos/. Para devolverle los datos a la
# cuenta hay que escribir el documento a mano, a conciencia.
set -e
cd "$(dirname "$0")/.."
PROYECTO="impulsa-d9262"
CORREO="$1"
MOMENTO="$2"
if [ -z "$CORREO" ]; then echo "uso: bash herramientas/rescatar.sh correo@ejemplo.com [HH:MM:SS]"; exit 1; fi
mkdir -p respaldos

REFRESH=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.config/configstore/firebase-tools.json')))['tokens']['refresh_token'])")
TOKEN=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -d refresh_token="$REFRESH" \
  -d client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com \
  -d client_secret=j9iVZfS8kkCEFUPaAeJV0sAi \
  -d grant_type=refresh_token \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/$PROYECTO/accounts:query" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' > /tmp/impulsa-cuentas.json
UID_BUSCADO=$(CORREO="$CORREO" python3 -c "
import json, os, sys
for u in json.load(open('/tmp/impulsa-cuentas.json')).get('userInfo', []):
    if u.get('email','').lower() == os.environ['CORREO'].lower(): print(u['localId']); sys.exit()
print('')")
if [ -z "$UID_BUSCADO" ]; then echo "no encuentro ninguna cuenta con el correo $CORREO"; exit 1; fi

FS="https://firestore.googleapis.com/v1/projects/$PROYECTO/databases/(default)/documents"
HOY=$(date -u +%Y-%m-%d)

resumen(){ # $1 = etiqueta
  python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('  %-9s %s' % ('$1', d['error']['message'][:60])); raise SystemExit
crudo = d.get('fields', {}).get('datos', {}).get('stringValue', '')
if not crudo: print('  %-9s (sin datos)' % '$1'); raise SystemExit
j = json.loads(crudo); dias = j.get('dias', {})
conteos = sum(1 for x in dias.values() for a,b in x.items() if a!='_metas' and b)
socios  = sum(x.get('socio',0) or 0 for x in dias.values())
ventas  = sum(x.get('venta',0) or 0 for x in dias.values())
print('  %-9s dias=%-3d conteos=%-4d prospectos=%-3d socios=%-2d ventas=%-2d' % (
    '$1', len(dias), conteos, len(j.get('prospectos', [])), socios, ventas))
"
}

if [ -z "$MOMENTO" ]; then
  echo "Línea de tiempo de $CORREO (hora UTC · ahora son las $(date -u +%H:%M)):"
  AHORA=$(date -u +%s)
  for ATRAS in 3300 3000 2700 2400 2100 1800 1500 1200 900 600 300 60; do
    T=$(date -u -r $((AHORA-ATRAS)) +%H:%M:%S 2>/dev/null || date -u -d "@$((AHORA-ATRAS))" +%H:%M:%S)
    curl -s "$FS/usuarios/$UID_BUSCADO?readTime=${HOY}T${T}Z" -H "Authorization: Bearer $TOKEN" | resumen "$T"
  done
  echo
  echo "Si ves un momento donde había más, repite con esa hora para guardarla:"
  echo "  bash herramientas/rescatar.sh $CORREO HH:MM:SS"
else
  DESTINO="respaldos/RESCATE-${CORREO%%@*}-${MOMENTO//:/}.json"
  curl -s "$FS/usuarios/$UID_BUSCADO?readTime=${HOY}T${MOMENTO}Z" -H "Authorization: Bearer $TOKEN" > /tmp/impulsa-rescate.json
  DESTINO="$DESTINO" python3 - <<'PY'
import json, os
d = json.load(open('/tmp/impulsa-rescate.json'))
if 'error' in d: raise SystemExit('no se pudo leer ese momento: ' + d['error']['message'])
j = json.loads(d['fields']['datos']['stringValue'])
destino = os.environ['DESTINO']
json.dump(j, open(destino, 'w'), ensure_ascii=False, indent=1)
nombres = {m['id']: m['nombre'] for m in j.get('metas', [])}
print('guardado en', destino, '\n')
for k, v in sorted(j.get('dias', {}).items()):
    reg = {a: b for a, b in v.items() if a != '_metas' and b}
    print(' ', k, '—', ', '.join(f"{b} {nombres.get(a,a)}" for a, b in reg.items()) or '(sin registros)')
print('\nprospectos:', [p.get('nombre') for p in j.get('prospectos', [])])
print('agenda:', [t.get('texto') for t in j.get('agenda', [])])
PY
fi
