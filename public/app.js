(function () {
  'use strict';

  var API = '/api/notes';
  var MAX_TITLE = 100;

  var notes = [];
  var editingId = null;
  var editError = '';
  var busy = false;

  var form = document.getElementById('note-form');
  var titleInput = document.getElementById('title');
  var textInput = document.getElementById('text');
  var titleError = document.getElementById('title-error');
  var titleCount = document.getElementById('title-count');
  var addBtn = document.getElementById('add-btn');
  var banner = document.getElementById('error');
  var list = document.getElementById('notes');
  var empty = document.getElementById('empty');

  // ---------- helpers ----------

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function request(method, url, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (res.status === 204) return null;
      return res.json();
    });
  }

  function sortNotes() {
    notes.sort(function (a, b) {
      if (a.created_at < b.created_at) return 1;
      if (a.created_at > b.created_at) return -1;
      return b.id - a.id;
    });
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  }

  function showError(message, retry) {
    banner.textContent = '';
    banner.appendChild(el('span', '', message));
    if (retry) {
      var btn = el('button', 'btn', 'Retry');
      btn.type = 'button';
      btn.addEventListener('click', retry);
      banner.appendChild(btn);
    }
    banner.hidden = false;
  }

  function clearError() {
    banner.hidden = true;
    banner.textContent = '';
  }

  // ---------- add form ----------

  function updateAddForm() {
    var len = titleInput.value.length;
    titleCount.textContent = len + '/' + MAX_TITLE;
    var blank = titleInput.value.trim() === '';
    addBtn.disabled = blank || busy;
    if (!blank) titleError.textContent = '';
  }

  titleInput.addEventListener('input', updateAddForm);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = titleInput.value.trim();
    if (!title) {
      titleError.textContent = 'Title is required';
      titleInput.focus();
      return;
    }
    if (title.length > MAX_TITLE) {
      titleError.textContent = 'Title must be at most ' + MAX_TITLE + ' characters';
      return;
    }
    busy = true;
    updateAddForm();
    request('POST', API, { title: title, text: textInput.value })
      .then(function (note) {
        notes.push(note);
        form.reset();
        clearError();
        render();
        titleInput.focus();
      })
      .catch(function () {
        showError('Could not save note.');
      })
      .then(function () {
        busy = false;
        updateAddForm();
      });
  });

  // ---------- rendering ----------

  function render() {
    sortNotes();
    list.textContent = '';
    notes.forEach(function (note) {
      list.appendChild(note.id === editingId ? buildEditCard(note) : buildCard(note));
    });
    empty.hidden = notes.length > 0;
    if (editingId !== null) {
      var input = list.querySelector('.note.editing input');
      if (input && document.activeElement !== input) input.focus();
    }
  }

  function buildCard(note) {
    var card = el('article', 'card note');
    card.dataset.id = String(note.id);
    card.appendChild(el('h2', 'note-title', note.title));
    card.appendChild(el('p', 'note-text', note.text));
    card.appendChild(el('p', 'meta', formatDate(note.created_at)));

    var actions = el('div', 'actions');
    var edit = el('button', 'btn btn-secondary', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', function () {
      editingId = note.id;
      editError = '';
      render();
    });
    var del = el('button', 'btn btn-danger-text', 'Delete');
    del.type = 'button';
    del.addEventListener('click', function () {
      if (!window.confirm('Delete this note?')) return;
      del.disabled = true;
      request('DELETE', API + '/' + note.id)
        .then(function () {
          notes = notes.filter(function (n) { return n.id !== note.id; });
          if (editingId === note.id) editingId = null;
          clearError();
          render();
        })
        .catch(function () {
          del.disabled = false;
          showError('Could not delete note.');
        });
    });
    actions.appendChild(edit);
    actions.appendChild(del);
    card.appendChild(actions);
    return card;
  }

  function buildEditCard(note) {
    var card = el('article', 'card note editing');
    card.dataset.id = String(note.id);

    var title = el('input');
    title.type = 'text';
    title.maxLength = MAX_TITLE;
    title.required = true;
    title.placeholder = 'Title';
    title.value = note.title;
    title.setAttribute('aria-label', 'Title');
    title.autocomplete = 'off';

    var row = el('div', 'field-row');
    var err = el('span', 'error', editError);
    var count = el('span', 'meta', title.value.length + '/' + MAX_TITLE);
    row.appendChild(err);
    row.appendChild(count);

    var text = el('textarea');
    text.rows = 4;
    text.placeholder = 'Write your note...';
    text.value = note.text;
    text.setAttribute('aria-label', 'Text');

    var actions = el('div', 'actions');
    var save = el('button', 'btn btn-primary', 'Save');
    save.type = 'button';
    var cancel = el('button', 'btn btn-secondary', 'Cancel');
    cancel.type = 'button';
    actions.appendChild(save);
    actions.appendChild(cancel);

    function sync() {
      count.textContent = title.value.length + '/' + MAX_TITLE;
      save.disabled = title.value.trim() === '';
    }
    sync();
    title.addEventListener('input', sync);

    function doCancel() {
      editingId = null;
      editError = '';
      render();
    }

    function doSave() {
      var t = title.value.trim();
      if (!t) return;
      save.disabled = true;
      request('PUT', API + '/' + note.id, { title: t, text: text.value })
        .then(function (updated) {
          notes = notes.map(function (n) { return n.id === updated.id ? updated : n; });
          editingId = null;
          editError = '';
          clearError();
          render();
        })
        .catch(function () {
          // keep the edit open and show the error inside the card
          err.textContent = 'Could not save note.';
          editError = 'Could not save note.';
          sync();
        });
    }

    save.addEventListener('click', doSave);
    cancel.addEventListener('click', doCancel);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') doCancel();
    });

    card.appendChild(title);
    card.appendChild(row);
    card.appendChild(text);
    card.appendChild(actions);
    return card;
  }

  // ---------- load ----------

  function load() {
    request('GET', API)
      .then(function (data) {
        notes = Array.isArray(data) ? data : [];
        clearError();
        render();
      })
      .catch(function () {
        showError('Could not load notes.', load);
        render();
      });
  }

  updateAddForm();
  load();
})();
