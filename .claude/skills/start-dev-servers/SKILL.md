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
     ```
     (Bindet automatisch auf `0.0.0.0` — läuft unverändert für jeden der folgenden Modi.)
   - **Terminal 2 – Frontend**
     ```bash
     cd "$(pwd)/apps/frontend" && pnpm run dev
     ```
     Reicht für alles, was nur im Mac-Browser auf `localhost:3000` getestet wird.

## Tests auf dem iPhone (oder anderem Gerät im selben WiFi)

Welches Frontend-Script du brauchst, hängt davon ab, ob die Kamera (Barcode-Scan, #149) eine
Rolle spielt — `getUserMedia` braucht einen **sicheren Kontext** (HTTPS oder `localhost`), und
über plain HTTP ist die Kamera auf dem Telefon schlicht nicht vorhanden, kein Prompt, kein
Fehler.

### Kamera / Barcode-Scan gebraucht → `pnpm run dev:https`

```bash
cd apps/frontend && pnpm run dev:https
```

Das ist der einzige Weg, den Scanner auf einem iPhone mit echter Kamera zu testen. Ein
Script, ein Terminal (Backend bleibt separat wie oben):

- Startet Next über HTTPS mit einem mkcert-Zertifikat und setzt `NEXT_PUBLIC_API_URL=/api`,
  sodass der Browser **keinen Cross-Origin-Call** macht — `next.config.ts`s Dev-Rewrite
  proxied `/api/*` zum Backend auf `:3001`. Ohne den Proxy ginge es über HTTPS gar nicht: ein
  `https://`-Origin, der direkt `http://…:3001` aufruft, ist **Mixed Content** und wird vom
  Browser blockiert, bevor CORS überhaupt ins Spiel kommt.
- `predev:https` reißt vor jedem Start `scripts/dev-cert.mjs` an und erneuert das Zertifikat
  um die aktuelle LAN-Adresse und den Bonjour-`.local`-Namen dieses Macs — Next selbst deckt
  mit `--experimental-https` nur `localhost`/`127.0.0.1` ab, und der Namens-Mismatch ist in
  iOS Safari ein Hard-Fail ohne "Trotzdem fortfahren".
- CORS (`main.ts`, `isLocalDevOrigin`) erlaubt bereits automatisch `localhost`, private Netze
  (`192.168.*`, `10.*`, `172.16-31.*`) und `*.local`-Namen, jeweils über `http` **und**
  `https` — normalerweise ist kein `CORS_ORIGIN` nötig.

Auf dem iPhone (gleiches WiFi, kein VPN):

1. Mac-Hostname holen: `scutil --get LocalHostName` (überlebt einen DHCP-Lease-Wechsel,
   die rohe IP nicht — deshalb den Namen bevorzugen).
2. Safari → `https://<LocalHostName>.local:3000`.
3. Die CA ist lokal, Safari warnt beim ersten Mal: **Details einblenden → Diese Website
   besuchen.** Kamera sollte danach funktionieren.
4. Falls Safari das nicht anbietet oder die Kamera trotzdem nicht startet, muss die CA einmal
   auf dem iPhone vertraut werden — die komplette Anleitung inkl. AirDrop-Schritt steht in
   [`docs/barcode-scanner-testing.md`](../../../docs/barcode-scanner-testing.md).

Nach einem Netzwerkwechsel einfach `pnpm run dev:https` neu starten — das Script merkt die
neue Adresse und erneuert das Zertifikat; die CA bleibt auf dem Telefon vertraut.

**Zwei Next-Config-Einstellungen sind nur dafür da und leicht zu vergessen, wenn ein Telefon
plötzlich "nicht einloggen kann":** `allowedDevOrigins` (sonst 403en die `/_next/*`-Dev-Assets
für jeden Host außer localhost, React hydriert nie, und kein Request erreicht je das Backend —
sieht aus wie ein kaputtes Login gegen eine gesunde API) und der `/api/*`-Rewrite von oben.
Beide werden aus den aktuellen Mac-Adressen berechnet, ein DHCP-Wechsel bricht also nichts
still.

### Keine Kamera nötig (nur UI/Login/Layout testen) → `pnpm run dev:mobile`

```bash
cd apps/frontend && pnpm run dev:mobile
```

Läuft über **plain HTTP** mit `NEXT_PUBLIC_API_URL` fest auf die Mac-IP gesetzt (in
`package.json` hinterlegt) — einfacher aufzusetzen, aber **keine Kamera**: der
Barcode-Scanner zeigt "Kamera braucht HTTPS" und fällt auf das manuelle EAN-Feld zurück, was
für alles außer dem Kamera-Pfad selbst ausreicht.

Ablauf:

1. Lokale Mac-IP prüfen (`ipconfig getifaddr en0`) und mit der in `dev:mobile` hinterlegten
   IP abgleichen — bei einem geänderten Netz das Script in `apps/frontend/package.json`
   anpassen oder manuell überschreiben:
   ```bash
   NEXT_PUBLIC_API_URL=http://<mac-ip>:3001/api pnpm run dev -- -H 0.0.0.0
   ```
2. Backend läuft wie oben (`pnpm run start:dev`, bindet automatisch auf `0.0.0.0`).
3. iPhone, gleiches WiFi: Safari → `http://<mac-ip>:3000` (mit `http://` und Port, nicht nur
   die IP eintippen — sonst startet Safari eine Google-Suche).

**Wichtig:** Ohne die passende `NEXT_PUBLIC_API_URL` lädt die Seite zwar, aber jeder API-Call
(Login etc.) geht vom iPhone aus an `localhost` und scheitert — deshalb nie nur `pnpm run
dev`, wenn ein anderes Gerät zugreifen soll.

## Troubleshooting (Telefon lädt nicht / verbindet nicht)

Gilt für beide Modi:

- **macOS-Firewall** ist die häufigste Ursache, wenn es vom Mac-Browser per IP geht, aber
  nicht vom Telefon: Systemeinstellungen → Netzwerk → Firewall → Firewall-Optionen → "node"
  / "next" / "Terminal" / "iTerm" eingehende Verbindungen erlauben. Nach einer Änderung immer
  den Server neu starten.
- Beide Geräte im selben WLAN, kein VPN, kein Gastnetz, iPhone-WLAN-Einstellung "Private
  Adresse" aus (kann sonst die Mac-Firewall-Regel umgehen).
- `lsof -i :3000 | grep LISTEN` sollte `*:3000` zeigen (Sternchen = alle Interfaces), nicht
  nur `127.0.0.1:3000`.
- Erreichbarkeit isoliert testen: `http://<mac-ip>` (ohne Port) vom iPhone aus — kommt eine
  Router-Seite oder ein Fehler, ist es Netzwerk/Firewall, nicht die App.

Bei Problemen speziell mit der Kamera (schwarzes Bild, "Kamera wird gestartet…" hängt, Scan
erkennt nichts) ist [`docs/barcode-scanner-testing.md`](../../../docs/barcode-scanner-testing.md)
die genauere Anlaufstelle — inklusive Testcodes pro Symbologie und was pro Browser-Engine
(Safari/zxing-Fallback vs. Chrome/natives `BarcodeDetector`) zu prüfen ist.
