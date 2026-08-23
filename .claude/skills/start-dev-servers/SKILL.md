---
name: start-dev-servers
description: Startet Backend und Frontend Dev-Server so automatisch wie möglich in separaten Terminals – minimalste Nachfragen, direkt ausführbar.
tags: [dev, local, start, servers, testing, automation]
---

Du bist der Dev-Environment Manager für den Workout Tracker.

**Ziel:** Backend und Frontend Dev-Server **so direkt und automatisch wie möglich** starten, ohne unnötige Nachfragen.

**Vorgehen (immer in dieser Reihenfolge):**

1. Prüfe kurz, ob die Server bereits auf Port 3000 oder 3001 laufen.
2. Öffne **zwei separate Terminal-Tabs/Fenster** (macOS Terminal oder iTerm) und starte dort automatisch:
   - **Terminal 1 – Backend**
     ```bash
     cd "$(pwd)/apps/backend" && pnpm run start:dev
**Für Tests auf iPhone / anderem Gerät im selben WiFi (lokal auf Mac-IP zugreifen):**

Die CORS-Konfiguration ist jetzt dev-freundlich (siehe main.ts):
- Erlaubt standardmäßig localhost:3000 + 127.0.0.1:3000 + private Netzwerke (192.168.*, 10.*, 172.16-31.*)
- Du kannst bei Bedarf explizit weitere Origins via CORS_ORIGIN hinzufügen.

Empfohlener Ablauf:

1. Finde die lokale IP deines Macs:
   ```bash
   ipconfig getifaddr en0   # für WiFi; ggf. en1 oder `ifconfig`
   ```
   Beispiel: 192.168.1.42

2. Backend starten (meist ohne spezielles CORS_ORIGIN nötig):
   ```bash
   cd apps/backend && pnpm run start:dev
   ```
   (Bindet automatisch auf 0.0.0.0.)

   Falls du explizit sein willst:
   ```bash
   CORS_ORIGIN="http://192.168.1.42:3000" pnpm run start:dev
   ```

3. Frontend starten mit der Mac-IP als API-URL (wichtig!):
   Einfach (empfohlen):
   ```bash
   cd apps/frontend && pnpm run dev:mobile
   ```
   (Das neue Script setzt automatisch NEXT_PUBLIC_API_URL=http://192.168.178.24:3001/api und bindet auf 0.0.0.0.)

   Oder manuell:
   ```bash
   cd apps/frontend && NEXT_PUBLIC_API_URL=http://192.168.178.24:3001/api pnpm run dev
   ```

4. Auf dem iPhone:
   - Gleiches WiFi (VPN aus!)
   - Safari → `http://192.168.1.42:3000`
   - Die App lädt und spricht mit dem Backend über die gesetzte NEXT_PUBLIC_API_URL.

**Hinweise & Troubleshooting (iPhone lädt nicht):**

**Wichtig: Du MUSST den Frontend-Server mit der korrekten Env-Variable starten, sonst lädt die App zwar die HTML, aber alle API-Calls (Login etc.) gehen an localhost auf dem iPhone und scheitern.**

1. **Auf dem Mac Terminal (Frontend-Ordner):**
   Empfohlen:
   ```bash
   pnpm run dev:mobile
   ```
   - Oder manuell: NEXT_PUBLIC_API_URL=http://192.168.178.24:3001/api pnpm run dev
   - Nicht nur `pnpm run dev`!
   - Warte bis du siehst:
     - Local:   http://localhost:3000
     - **Network: http://192.168.178.24:3000**   <--- das ist die URL fürs iPhone (kopiere sie!)

     **Wichtig:** Next.js zeigt oft "http://0.0.0.0:3000" in der Network-Zeile bei -H 0.0.0.0. Das ist normal und **nicht** die Adresse, die du auf dem iPhone verwenden sollst!
     Verwende immer deine echte Mac-IP: `http://192.168.178.24:3000` auf dem iPhone. 0.0.0.0 funktioniert nicht von anderen Geräten aus.

2. **Backend muss auch laufen** (anderes Terminal):
   ```bash
   cd apps/backend && pnpm run start:dev
   ```

3. **Auf dem iPhone Safari exakt eingeben (kopieren aus dem Mac-Terminal!):**
   `http://192.168.178.24:3000`

   - Mit `http://` am Anfang
   - Mit `:3000` am Ende
   - Safari Adressleiste nicht nur IP eintippen (sonst Google-Suche)

4. **Falls es immer noch nicht lädt:**
   - Stelle sicher, dass beide Server auf dem Mac laufen und **keine Fehler** im Terminal haben.
   - Mac Firewall: Erlaube "node" oder "Terminal" für eingehende Verbindungen (Systemeinstellungen > Netzwerk > Firewall).
   - iPhone und Mac im selben WLAN (kein VPN, kein Mobile-Hotspot).
   - Teste vom Mac aus, ob http://192.168.178.24:3000 im Browser funktioniert (sollte die App laden).
   - Starte beide Server neu nach Änderungen.

**Mac Firewall häufiges Problem (wenn es auf Mac per IP geht, aber nicht vom iPhone):**
- Das ist **fast immer** die macOS Firewall, die Verbindungen vom iPhone blockt (auch wenn Mac-Browser die IP erreicht).
- Gehe zu: Systemeinstellungen > Netzwerk > Firewall (rechts oben) > "Firewall-Optionen..."
- In der Liste nach "node", "next", "Terminal" oder "iTerm" suchen und "Eingehende Verbindungen erlauben" anhaken.
- Alternativ: Firewall temporär komplett deaktivieren (Häkchen oben raus) zum Testen → Server neu starten → wenn es geht, Firewall wieder an und die App erlauben.
- Wichtig: Nach Firewall-Änderung immer `Ctrl + C` im Terminal und `pnpm run dev:mobile` neu starten.

**Zusätzliche Checks:**
- Stelle sicher, dass im Mac-Terminal beim Start von `pnpm run dev:mobile` die Zeile steht (auch wenn sie "0.0.0.0" zeigt):
  Kopiere **deine echte IP** aus dem "Network"-Bereich oder nutze `192.168.178.24:3000` und baue die URL `http://192.168.178.24:3000` auf dem iPhone.
  (0.0.0.0 ist nicht zum Verbinden von anderen Geräten geeignet — immer die reale IP verwenden!)
- Teste auf dem iPhone, ob du die Mac-IP überhaupt erreichen kannst: Versuche `http://192.168.178.24` (ohne :3000). Wenn das eine Router-Seite oder Fehler zeigt, ist es Netzwerk/Firewall.
- iPhone: "Private Adresse" für das WLAN deaktivieren (Einstellungen > WLAN > das Netzwerk > "Private Adresse" aus).
- Beide Geräte im selben WLAN (nicht eines im 5GHz, eines im 2.4GHz wenn getrennt, kein Gastnetz).
- Auf dem Mac: `lsof -i :3000 | grep LISTEN` sollte etwas mit `*:3000` zeigen (Sternchen = alle Interfaces).

Falls du die exakte Fehlermeldung auf dem iPhone (oder was genau passiert - weiße Seite? Timeout? "Seite kann nicht geladen werden"?) und den Output der beiden Mac-Terminals (die letzten 10 Zeilen von frontend und backend) hier postest, kann ich genauer helfen.

Die .env.local im Frontend hat jetzt auch Kommentare mit deiner IP.
