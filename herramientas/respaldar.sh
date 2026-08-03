#!/bin/bash
# Respaldo de todas las cuentas de Impulsa a un archivo local.
#
#   bash herramientas/respaldar.sh
#
# Usa la sesión del CLI de Firebase que ya está en esta Mac, así que no hace
# falta ninguna llave ni contraseña. Los archivos van a respaldos/, que está en
# .gitignore: son datos de la red y no deben acabar en el repositorio público.
#
# Firestore en plan gratuito guarda solo 1 HORA de historial y no tiene
# recuperación a un punto en el tiempo, así que este respaldo es la única red
# de seguridad real. Conviene correrlo de vez en cuando.
# Para rescatar algo dentro de esa hora, ver rescatar.sh.
set -e
cd "$(dirname "$0")/.."
PROYECTO="impulsa-d9262"
DESTINO="respaldos/impulsa-$(date +%Y-%m-%d_%H%M).json"
mkdir -p respaldos

# El id y el secreto de abajo NO son tuyos: son las credenciales públicas del
# propio CLI de Firebase (están en su código abierto). Lo que da acceso es tu
# sesión guardada en esta Mac, que nunca sale de aquí.
REFRESH=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.config/configstore/firebase-tools.json')))['tokens']['refresh_token'])")
TOKEN=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -d refresh_token="$REFRESH" \
  -d client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com \
  -d client_secret=j9iVZfS8kkCEFUPaAeJV0sAi \
  -d grant_type=refresh_token \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

FS="https://firestore.googleapis.com/v1/projects/$PROYECTO/databases/(default)/documents"
curl -s "$FS/usuarios?pageSize=300" -H "Authorization: Bearer $TOKEN" > /tmp/impulsa-usuarios.json
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/$PROYECTO/accounts:query" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' > /tmp/impulsa-cuentas.json

DESTINO="$DESTINO" python3 - <<'PY'
import json, os, datetime
docs = json.load(open('/tmp/impulsa-usuarios.json')).get('documents', [])
correos = {u['localId']: u.get('email', '')
           for u in json.load(open('/tmp/impulsa-cuentas.json')).get('userInfo', [])}
salida = {}
for x in docs:
    uid = x['name'].split('/')[-1]
    f = x.get('fields', {})
    crudo = f.get('datos', {}).get('stringValue', '')
    salida[uid] = {
        'correo': correos.get(uid, ''),
        'actualizado': int(f.get('actualizado', {}).get('integerValue') or 0),
        'datos': json.loads(crudo) if crudo else None,
    }
destino = os.environ['DESTINO']
json.dump(salida, open(destino, 'w'), ensure_ascii=False, indent=1)
print(f"{len(salida)} cuentas guardadas en {destino}\n")
for uid, v in sorted(salida.items(), key=lambda kv: -kv[1]['actualizado']):
    j = v['datos'] or {}
    conteos = sum(1 for dia in j.get('dias', {}).values()
                  for a, b in dia.items() if a != '_metas' and b)
    cuando = datetime.datetime.fromtimestamp(v['actualizado']/1000).strftime('%m-%d %H:%M')
    print(f"  {v['correo'][:38]:40} {cuando}  conteos={conteos:<4} prospectos={len(j.get('prospectos', []))}")
PY
