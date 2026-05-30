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
     cd "$(pwd)/apps/backend" && npm run start:dev