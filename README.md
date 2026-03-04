# Rawy
*A minimal editor for focused writing.*

Rawy is a lightweight editor built for a dedicated writing device — a modern "writer’s deck". The goal is to create a distraction-free interface that boots directly into writing, while still supporting basic project organization and synchronization.

The project is designed to run on lightweight hardware such as a Raspberry Pi connected to a small touchscreen display, but the editor can also run in a normal browser.

The name **Rawy (راوي)** means *storyteller* or *narrator* in Arabic.

---

## Project Goals

Rawy is designed around a few core ideas:

- **Instant access to writing**  
  The device should boot directly into the editor.

- **Minimal UI**  
  Less bells and whistles, more writing.

- **Focus Mode**
  Just write. No edits.

- **Structured writing projects**  
  Support organizing writing into projects, chapters, and notes.

- **Portable storage**  
  Projects are stored as structured JSON rather than relying on filesystem structure.

- **Offline first**  
  The device must work without internet access.

- **Cloud sync potential**  
  Storage design should make future syncing possible.

---

## Current Status

Early prototype.

The repository currently contains the initial web application that will power the Rawy editor.

Planned features include:

- Project creation and management
- Chapter / document navigation
- Focus writing mode
- Autosave
- JSON project storage
- Export to Markdown or plain text

---

## Tech Stack

Current implementation uses:

- **TypeScript**
- **Vite**
- **HTML + CSS**
- **WPE Webkit**

Future possibilities:

- IndexedDB for storage
- Markdown support
- Optional sync layer

The UI is intentionally simple to ensure it runs smoothly on low-power hardware.
