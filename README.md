# TV Hoerde – Volleyball Website

Automatische Vereinswebsite für TV Hoerde Volleyball mit täglichem Datenabruf vom WVV-Ergebnisdienst.

## Dateien

| Datei | Beschreibung |
|---|---|
| `tvhoerde.html` | Die Website |
| `scraper.js` | Holt Daten vom WVV-Ergebnisdienst |
| `tvhoerde-data.json` | Gescrappte Daten (wird automatisch aktualisiert) |
| `package.json` | Node.js-Abhängigkeiten |
| `.github/workflows/scraper.yml` | GitHub Actions – läuft täglich um 07:00 Uhr |

## Setup

### 1. Repository erstellen
```bash
git init
git add .
git commit -m "Erster Commit"
git remote add origin https://github.com/DEINNAME/tvhoerde.git
git push -u origin main
```

### 2. GitHub Pages aktivieren
- GitHub → Repository → Settings → Pages
- Source: `main` Branch, `/ (root)` Ordner
- Die Website ist dann erreichbar unter: `https://DEINNAME.github.io/tvhoerde`

### 3. GitHub Actions erlauben zu pushen
- GitHub → Repository → Settings → Actions → General
- Unter "Workflow permissions": **"Read and write permissions"** auswählen
- Speichern

### 4. Ersten Scraper-Lauf starten
- GitHub → Repository → Actions → "WVV Daten aktualisieren" → "Run workflow"

## Lokale Entwicklung

```bash
npm install
node scraper.js        # Daten abrufen
# Dann tvhoerde.html im Browser öffnen
```

## Automatische Updates

Der Scraper läuft automatisch jeden Morgen um 07:00 Uhr (deutsche Zeit) und aktualisiert `tvhoerde-data.json`.
