# elemental-demo

A todo app that demonstrates the core API of [@fynyky/elemental](https://github.com/fynyky/elemental), a minimal reactive UI library with no build step required.

## Live demo

[https://fynyky.github.io/elemental-demo/](https://fynyky.github.io/elemental-demo/)

## Running

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## What this demonstrates

The app is a walkthrough of elemental's API. Read [index.js](index.js) top to bottom — each section introduces one concept.

| Feature | What it shows |
|---|---|
| `Reactor` | Reactive state wrapper — reads inside an `Observer` create live dependencies |
| `el()` | DOM builder using CSS selector syntax (`'tag.class#id'`) |
| `ob()` | Reactive observer that manages a DOM slot and re-runs when dependencies change |
| `bind()` | Two-way sync between a `Reactor` property and an input field |
| `attr()` | Configurator that calls `setAttribute` on the parent element |
| `hide()` | Reads a `Reactor` property without registering a dependency |
| `batch()` | Groups multiple state mutations so observers fire only once |

## Library

elemental has two primitives:

- **`Reactor`** — a Proxy around a plain object. Reading a property inside an `Observer` registers a live dependency on it.
- **`Observer`** — a function that re-runs automatically when any `Reactor` property it read during its last run changes.

Everything else (`el`, `ob`, `attr`, `bind`, `hide`, `batch`) is DOM-building sugar or a utility built on top of those two.
