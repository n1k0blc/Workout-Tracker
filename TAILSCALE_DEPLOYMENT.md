# Remote Deployment via Tailscale VPN

## Übersicht

Tailscale ist ein Mesh-VPN, das verschlüsselte Peer-to-Peer-Verbindungen zwischen deinen Geräten erstellt. Im Gegensatz zu traditionellen VPNs wird **nicht der gesamte Traffic** durch einen VPN-Server geleitet – nur die Kommunikation zwischen deinen registrierten Geräten ist verschlüsselt.

### Vorteile
- ✅ Zugriff auf den Raspberry Pi von überall (Café, Arbeit, unterwegs)
- ✅ Sichere, verschlüsselte Verbindung
- ✅ Kein Port-Forwarding oder Router-Konfiguration nötig
- ✅ Zero-Trust-Architektur
- ✅ Pi behält direkte Internet-Verbindung (zu GitHub, Docker Hub, etc.)

### Geräte im Netzwerk
- **Mac:** `100.116.63.30` (macbookair)
- **Raspberry Pi:** `100.126.189.87` (n1k0blc-pi)

---

## Einmalige Einrichtung

### Auf dem Raspberry Pi (bereits erledigt ✅)

```bash
# Tailscale installieren
curl -fsSL https://tailscale.com/install.sh | sh

# Tailscale starten und authentifizieren
sudo tailscale up
# Browser-Link öffnen und mit Tailscale-Account einloggen
```

### Auf dem Mac (bereits erledigt ✅)

```bash
# Tailscale via Homebrew installieren
brew install tailscale

# Tailscale-Service starten
brew services start tailscale

# Authentifizieren
sudo tailscale up
# Browser-Link öffnen und mit DEMSELBEN Tailscale-Account einloggen
```

**Wichtig:** Beide Geräte müssen mit dem gleichen Tailscale-Account authentifiziert werden!

---

## Remote Deployment (täglich nutzen)

### 1. SSH-Verbindung zum Pi aufbauen

Von überall (außerhalb des Heimnetzwerks):

```bash
ssh n1k0@100.126.189.87
```

**Nicht verwenden** (funktioniert nur im Heimnetzwerk):
```bash
ssh n1k0@n1k0blc-pi.local        # ❌ Nur lokal
ssh n1k0@192.168.178.57          # ❌ Nur lokal
```

### 2. Deployment durchführen

Nach erfolgreicher SSH-Verbindung:

```bash
# In das Projekt-Verzeichnis wechseln
cd ~/apps/Workout-Tracker

# Aktuellen Branch prüfen
git branch

# Zu main-Branch wechseln (falls nicht schon dort)
git checkout main

# Neueste Änderungen von GitHub holen
git pull origin main

# Deployment-Script ausführen
./deploy.sh

# Optional: Logs verfolgen
docker logs -f workout-tracker-backend-prod
docker logs -f workout-tracker-frontend-prod
```

### 3. Deployment verifizieren

```bash
# Laufende Container prüfen
docker ps

# Status des Backends testen
curl -I http://localhost:3001/api/health

# Status des Frontends testen
curl -I http://localhost:3000
```

Website aufrufen: https://workout.nikobjelic.com

---

## Workflow für neue Features

1. **Entwickeln auf Mac:**
   ```bash
   # Feature auf dev-Branch entwickeln
   git checkout dev
   # ... Code ändern ...
   git add .
   git commit -m "feat: New feature"
   git push origin dev
   ```

2. **Pull Request erstellen:**
   - Auf GitHub: https://github.com/n1k0blc/Workout-Tracker
   - PR erstellen: `dev` → `main`
   - PR reviewen und mergen

3. **Auf Pi deployen:**
   ```bash
   # Via Tailscale zum Pi verbinden (von überall möglich)
   ssh n1k0@100.126.189.87
   
   # Deployment durchführen
   cd ~/apps/Workout-Tracker
   git pull origin main
   ./deploy.sh
   ```

---

## Nützliche Befehle

### Tailscale Status prüfen

```bash
# Alle Geräte im Netzwerk anzeigen
tailscale status

# Tailscale-IP-Adresse anzeigen
tailscale ip
```

### Tailscale neu starten

```bash
# Mac
brew services restart tailscale

# Raspberry Pi
sudo systemctl restart tailscaled
```

### Verbindung testen

```bash
# Ping zum Pi
ping 100.126.189.87

# SSH-Verbindung testen
ssh -v n1k0@100.126.189.87
```

---

## Troubleshooting

### Problem: SSH-Verbindung schlägt fehl

**Lösung 1:** Tailscale-Status prüfen
```bash
tailscale status
# Beide Geräte sollten aufgelistet sein
```

**Lösung 2:** Tailscale neu authentifizieren
```bash
sudo tailscale down
sudo tailscale up
```

**Lösung 3:** SSH-Schlüssel prüfen
```bash
ssh-add -l  # SSH-Keys auflisten
```

### Problem: "Failed to connect to local Tailscale service"

**Lösung:** Tailscale-Service starten
```bash
# Mac
brew services start tailscale

# Pi
sudo systemctl start tailscaled
```

### Problem: Pi ist offline in Tailscale

**Lösung:** Pi lokal (oder über Heimnetzwerk) neu starten
```bash
# Im Heimnetzwerk:
ssh n1k0@n1k0blc-pi.local
sudo tailscale up
```

---

## Sicherheitshinweise

- 🔒 **Niemals Passwörter in Git committen**
- 🔒 **SSH-Keys sind privat** – nicht teilen
- 🔒 **Tailscale-Account schützen** (2FA empfohlen)
- 🔒 **Pi nur über Tailscale zugänglich** (kein Port-Forwarding im Router)

---

## Alternative: Deployment im Heimnetzwerk

Falls Tailscale nicht verfügbar ist, kannst du im Heimnetzwerk die lokale Adresse nutzen:

```bash
# Im Heimnetzwerk
ssh n1k0@n1k0blc-pi.local

# Oder via IP
ssh n1k0@192.168.178.57
```

**Empfehlung:** Nutze immer Tailscale-IP (`100.126.189.87`) – funktioniert überall! 🚀
