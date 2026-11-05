# QuickNotes Design Spec

Single-page card layout. One accent color, system font, mobile first. No images.

## Color tokens

```css
:root {
  --accent: #4F46E5;
  --accent-hover: #4338CA;
  --accent-soft: #EEF2FF;
  --bg: #F9FAFB;
  --surface: #FFFFFF;
  --text: #111827;
  --text-muted: #6B7280;
  --border: #E5E7EB;
  --danger: #B91C1C;
  --danger-soft: #FEF2F2;
  --radius: 10px;
  --shadow: 0 1px 3px rgba(0,0,0,.08);
}
```

Accent is used for the primary button, focus rings and links. Danger is used only for errors and the delete confirm.

## Typography

- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Page title (h1) 1.75rem / 700. Note title (h2) 1.1rem / 600. Body 1rem / 1.5. Meta and counter 0.8rem, `--text-muted`.

## Spacing and breakpoint

- Scale: 4, 8, 12, 16, 24, 32px.
- Container: `max-width: 640px; margin: 0 auto; padding: 24px 16px`.
- One breakpoint: `@media (max-width: 480px)`. Padding drops to 12px. Card action buttons stack full width. Inputs and buttons are at least 44px tall. Use font-size 16px on inputs so iOS does not zoom.

## Layout (top to bottom)

1. Header: h1 "QuickNotes".
2. Add form card.
3. Error banner (hidden unless there is an error).
4. Notes list: vertical stack of cards, 12px gap, newest first.

## Components

### Add form
- Title input: `required`, `maxlength="100"`, placeholder "Title". Live counter "0/100" at the right below the input.
- Text textarea: 4 rows, placeholder "Write your note...".
- Primary button "Add note" (accent background, white text). Disabled when the title is blank after trim.
- After success: clear the form and focus the title.
- Validation: blank title shows "Title is required" under the input in `--danger`.

### Note card
- `--surface` background, 1px `--border`, `--radius`, `--shadow`, padding 16px.
- Title, then text (`white-space: pre-wrap`, `overflow-wrap: anywhere`), then a meta line with the date.
- Actions at the bottom right: "Edit" (secondary, outlined in accent) and "Delete" (text button, `--danger`).

### Inline edit state
- The card swaps its content for an input (title, same rules as the add form, with counter) and a textarea.
- Border becomes 2px `--accent`.
- Buttons: "Save" (primary) and "Cancel" (secondary). Esc cancels. Only one card is editable at a time.
- Save is disabled while the title is blank. On a failed save, keep the edit open and show the error inside the card.

### Delete confirm
- Clicking "Delete" uses `window.confirm("Delete this note?")`. Cancel does nothing. OK calls DELETE and removes the card.
- No custom modal is needed.

### Empty state
- Centered muted text: "No notes yet. Add your first note above." Shown in the list area when there are no notes. Hide it as soon as a note exists.

### Error state
- Banner: `--danger-soft` background, `--danger` text, 1px danger border, radius, `role="alert"`.
- Messages: "Could not load notes.", "Could not save note.", "Could not delete note."
- Loading failures show a "Retry" button in the banner. Dismiss the banner on the next successful action.

## Structure guidance for the frontend

Files served by Express from `public/`: `index.html`, `styles.css`, `app.js`.

```html
<main class="container">
  <h1>QuickNotes</h1>
  <form id="note-form" class="card" novalidate>
    <label for="title" class="sr-only">Title</label>
    <input id="title" name="title" maxlength="100" required placeholder="Title">
    <div class="field-row"><span id="title-error" class="error"></span><span id="title-count" class="meta">0/100</span></div>
    <label for="text" class="sr-only">Text</label>
    <textarea id="text" name="text" rows="4" placeholder="Write your note..."></textarea>
    <button type="submit" class="btn btn-primary">Add note</button>
  </form>
  <div id="error" class="banner" role="alert" hidden></div>
  <section id="notes" aria-live="polite"></section>
  <p id="empty" class="empty" hidden>No notes yet. Add your first note above.</p>
</main>
```

Card skeleton (built with `createElement`):

```html
<article class="card note" data-id="1">
  <h2 class="note-title"></h2>
  <p class="note-text"></p>
  <p class="meta"></p>
  <div class="actions"><button class="btn btn-secondary">Edit</button><button class="btn btn-danger-text">Delete</button></div>
</article>
```

JS rules:
- Render all note title and text with `textContent`, never `innerHTML`, to prevent XSS.
- Keep state in one `notes` array. Sort by `created_at` descending, with `id` descending as a tie-breaker. Re-render after each API call.
- Use `fetch` against `/api/notes` (GET, POST, PUT `/:id`, DELETE `/:id`). Check `res.ok` and show the error banner on failure.
- Use visible focus styles: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.
