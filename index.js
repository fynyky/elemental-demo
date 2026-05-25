// ─────────────────────────────────────────────────────────────────────────────
// Elemental Todo Demo
//
// This file is a walkthrough of @fynyky/elemental's core API. Read it top to
// bottom — each section introduces one new concept.
//
// The library has two moving parts:
//   Reactor   — a reactive wrapper around a plain object. Reading a property
//               inside an Observer creates a live dependency on it.
//   Observer  — a function that tracks which Reactor properties it reads and
//               automatically re-runs whenever any of them change.
//
// Everything else (el, ob, attr, bind, hide, batch) is either DOM-building
// sugar or a utility built on top of those two primitives.
// ─────────────────────────────────────────────────────────────────────────────
import { el, Reactor, ob, attr, bind, hide, batch } from '@fynyky/elemental'


// ─────────────────────────────────────────────────────────────────────────────
// STATE  —  new Reactor({ ... })
//
// Reactor wraps a plain object with a Proxy. The result looks and acts like a
// normal object, with one superpower: any Observer that reads a property during
// its execution is automatically registered as a dependent of that property.
// When you later assign a new value to that property, every dependent Observer
// re-runs.
//
// Nested objects and arrays are also deeply wrapped, so normal JavaScript works
// as expected — state.todos.push(x) triggers any observer that read state.todos.
// ─────────────────────────────────────────────────────────────────────────────
const state = new Reactor({
  todos: [],
  filter: 'all',  // 'all' | 'active' | 'completed'
  input: ''
})


// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
//
// Plain functions that update state. There is nothing special about them —
// they are not decorated, wrapped, or registered anywhere. They just assign
// to Reactor properties, and the reactivity system takes care of the rest.
// ─────────────────────────────────────────────────────────────────────────────

function addTodo () {
  const text = state.input.trim()
  if (!text) return
  state.todos.push({ text, completed: false })
  state.input = ''  // bind() is watching this — the input field clears instantly
}

function toggleTodo (todo) {
  todo.completed = !todo.completed
}

function deleteTodo (todo) {
  const index = state.todos.findIndex(t => t === todo)
  if (index !== -1) state.todos.splice(index, 1)
}

// batch() — groups multiple mutations into one notification pass.
//
// Without batch(), each state change fires observers separately. With batch(),
// observers wait until the block finishes, then each affected observer re-runs
// exactly once. Useful any time you need to update several pieces of state
// that share downstream observers.
function clearCompleted () {
  batch(() => {
    const kept = state.todos.filter(t => !t.completed)
    state.todos.splice(0, state.todos.length, ...kept)
    // If we're viewing the completed filter and clear it, reset the view —
    // otherwise the list shows "No todos match this filter" confusingly.
    if (state.filter === 'completed') state.filter = 'all'
  })
}

function toggleAll () {
  const allComplete = state.todos.every(t => t.completed)
  batch(() => {
    state.todos.forEach(t => { t.completed = !allComplete })
  })
}


// ─────────────────────────────────────────────────────────────────────────────
// EVENT HELPER
//
// el() treats function children as element configurators — it calls them with
// the parent element as both `this` and the first argument. attr() is a
// pre-built configurator that calls setAttribute, but setAttribute doesn't
// work for event handlers (it converts functions to strings). So we write our
// own one-liner that uses addEventListener instead.
//
// Usage inside el():  on('click', handler)
// What it does:       (element) => element.addEventListener('click', handler)
// ─────────────────────────────────────────────────────────────────────────────
const on = (event, fn) => (element) => element.addEventListener(event, fn)


// ─────────────────────────────────────────────────────────────────────────────
// TODO ITEM  —  per-item Observer
//
// Each call to todoItem() returns its own ob(). The observer reads
// todo.completed directly from the reactive todo object (which is itself
// deeply proxied), so it re-runs only when THIS todo's completed flag changes
// — not when other todos change.
//
// bind(todo, 'text') keeps the text input in sync with the reactive todo
// object in both directions, so edits persist into state automatically.
// ─────────────────────────────────────────────────────────────────────────────
function todoItem (todo) {
  return ob(() =>
    el('li',
      attr('class', todo.completed ? 'todo-item completed' : 'todo-item'),
      on('click', e => {
        if (e.target === e.currentTarget) {
          const input = e.currentTarget.querySelector('input.todo-text')
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        }
      }),

      el('input',
        attr('type', 'checkbox'),
        attr('aria-label', 'Toggle completion'),
        todo.completed ? attr('checked', '') : null,
        on('change', () => toggleTodo(todo)),
        on('click', e => e.stopPropagation())
      ),

      el('input.todo-text',
        attr('type', 'text'),
        bind(todo, 'text'),
        on('keydown', e => {
          if (e.key === 'Enter' || e.key === 'Escape') e.target.blur()
        })
      ),

      el('button.delete-btn',
        attr('title', 'Delete'),
        attr('aria-label', 'Delete todo'),
        on('click', e => { e.stopPropagation(); deleteTodo(todo) }),
        '×'
      )
    )
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// APP
//
// The entire UI is built here with nested el() calls. el(document.body, ...)
// uses the existing <body> as the mount point rather than creating a new node.
// ─────────────────────────────────────────────────────────────────────────────
el(document.body,
  el('div.app',

    // ── Header ───────────────────────────────────────────────────────────────
    // Static markup — no reactivity needed, so no ob().
    el('header',
      el('h1', 'todos'),
      el('p.tagline',
        'built with ',
        el('a',
          attr('href', 'https://github.com/fynyky/elemental'),
          attr('target', '_blank'),
          attr('rel', 'noopener'),
          'elemental'
        )
      )
    ),

    el('main.card',

      // ── Input row ───────────────────────────────────────────────────────────
      el('div.input-row',

        el('input.todo-input',
          attr('type', 'text'),
          attr('placeholder', 'What needs to be done?'),
          attr('autofocus', ''),

          // bind(reactor, key) — two-way sync between a Reactor property and
          // an input field. Under the hood it does two things:
          //   1. Adds an 'input' event listener that writes field → reactor
          //   2. Returns an Observer that writes reactor → field
          // Result: typing updates state.input; assigning state.input = ''
          // clears the field. No manual event wiring needed.
          bind(state, 'input'),

          on('keydown', (e) => {
            if (e.key === 'Enter') addTodo()
            if (e.key === 'Escape') state.input = ''
          })
        ),

        el('button.add-btn',
          attr('aria-label', 'Add todo'),
          on('click', addTodo),
          '+'
        )
      ),

      // ── Duplicate todo warning  —  ob() + hide() ─────────────────────────────────
      //
      // ob(fn) is shorthand for new Observer(fn). When used as an el() child,
      // the Observer manages a reactive slot: a pair of comment nodes bookmark
      // its position, and whenever the observer re-runs, the content between
      // them is cleared and replaced with the new return value.
      //
      // This observer reads state.input, so it re-runs on every keystroke.
      //
      // hide(fn) reads a Reactor property WITHOUT registering a dependency on
      // it. Here we use it to read state.todos for the duplicate check. Because
      // the read is hidden, adding or deleting a todo will NOT re-trigger this
      // observer — only typing will. This is the right behavior: we want the
      // warning to update as the user types, not flicker every time the list
      // changes.
      ob(() => {
        const text = state.input.toLowerCase().trim()
        if (!text) return null  // returning null clears the slot (shows nothing)

        const todos = hide(() => state.todos)  // read without creating a dependency
        const isDuplicate = todos.some(t => t.text.toLowerCase() === text)

        return isDuplicate
          ? el('p.warning', '⚠ That todo already exists')
          : null
      }),

      // ── Toolbar  —  conditional rendering with ob() ──────────────────────────
      //
      // Reading state.todos and state.filter inside this ob() creates a dependency
      // on both. The toolbar re-renders whenever either changes, so every child
      // always reflects current data with no inner observers needed.
      //
      // Returning null from an ob() removes all content from its slot —
      // this is how we hide the toolbar when the list is empty.
      ob(() => {
        const todos = state.todos
        const filter = state.filter
        if (todos.length === 0) return null

        const allComplete = todos.length > 0 && todos.every(t => t.completed)
        return el('div.toolbar',

          el('button.filter-btn',
            on('click', toggleAll),
            allComplete ? 'Unmark all' : 'Mark all complete'
          ),

          el('div.filters',
            ...['all', 'active', 'completed'].map(f =>
              el('button',
                attr('class', `filter-btn${filter === f ? ' active' : ''}`),
                on('click', () => { state.filter = f }),
                f[0].toUpperCase() + f.slice(1)
              )
            )
          )
        )
      }),

      // ── Todo list  —  ob() reading multiple properties ───────────────────────
      //
      // Destructuring state inside ob() reads both state.todos and state.filter,
      // creating a dependency on each. The observer re-runs when either changes.
      //
      // el() accepts arrays as children, so ...visible.map(todoItem) spreads
      // the array of observer-backed <li> elements directly into the call.
      ob(() => {
        const { todos, filter } = state
        const visible =
          filter === 'active'    ? todos.filter(t => !t.completed) :
          filter === 'completed' ? todos.filter(t => t.completed) :
          todos

        if (todos.length === 0) return el('p.empty-state', 'No todos yet — add one above!')
        if (visible.length === 0) return el('p.empty-state', 'No todos match this filter.')
        return el('ul.todo-list', ...visible.map(todoItem))
      }),

      // ── Footer  —  derived data in ob() ─────────────────────────────────────
      //
      // Computing `n` inside the observer means it automatically re-calculates
      // whenever state.todos changes. No need to maintain a separate "count"
      // property in state — derived values live in the observer.
      ob(() => {
        const todos = state.todos
        if (todos.length === 0) return null
        const n = todos.filter(t => !t.completed).length
        return el('footer.footer',
          el('span.count', `${n} item${n !== 1 ? 's' : ''} left`),
          // Conditional child: null is ignored, so this button only appears
          // when there is something to clear.
          todos.some(t => t.completed)
            ? el('button.clear-btn', on('click', clearCompleted), 'Clear completed')
            : null
        )
      })

    ),

    // ── Feature legend ────────────────────────────────────────────────────────
    el('aside.legend',
      el('h2', 'Elemental features used'),
      el('dl',
        el('dt', el('code', 'Reactor')),
        el('dd', 'Wraps a plain object — property assignments notify all dependent observers'),

        el('dt', el('code', 'el()')),
        el('dd', 'Builds DOM with CSS selector descriptors (\'tag.class#id\'); accepts strings, elements, functions, observers, arrays, and null as children'),

        el('dt', el('code', 'ob()')),
        el('dd', 'Creates an Observer that auto-tracks reactive reads and re-runs when dependencies change; manages a DOM slot between comment bookmarks'),

        el('dt', el('code', 'bind()')),
        el('dd', 'Two-way sync between a Reactor property and an input field — wired to the main input above'),

        el('dt', el('code', 'attr()')),
        el('dd', 'Returns a configurator function that calls setAttribute on the parent element; combine with ob() to update a single attribute reactively'),

        el('dt', el('code', 'hide()')),
        el('dd', 'Reads a Reactor property without registering a dependency — used in the duplicate warning so only typing (not todo changes) triggers it'),

        el('dt', el('code', 'batch()')),
        el('dd', 'Defers observer notifications until the block completes, so multiple state changes trigger each dependent observer only once')
      )
    )
  )
)
