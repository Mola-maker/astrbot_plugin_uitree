/* UI Tree 页面控制器 —— 同时支持 AstrBot Plugin Page（window.AstrBotPluginPage）
 * 与独立演示（无 bridge，回退到内置预设）。两个页面共用同一份逻辑。
 */
(function () {
  'use strict';

  var U = window.UItree;
  var bridge = window.AstrBotPluginPage;
  var app = { tree: null, presets: [], collapsed: new Set(), selected: '', view: 'preview' };

  function $(s) { return document.querySelector(s); }
  function esc(s) { return U.esc(s); }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function nodeByPath(path) {
    if (!path) return app.tree;
    var node = app.tree;
    path.split('.').map(Number).forEach(function (i) { node = node.children[i]; });
    return node;
  }

  function setTabsActive(node, idx) {
    if (node.type === 'Tabs') { node.state = node.state || {}; node.state.active = idx; return true; }
    return (node.children || []).some(function (c) { return setTabsActive(c, idx); });
  }

  function render() {
    $('#inspector').innerHTML = U.renderInspector(app.tree, app.collapsed);
    $('#preview').innerHTML = U.renderPreview(app.tree);
    $('#json-editor').value = U.renderJson(app.tree);

    if (app.selected != null && app.selected !== '') {
      var n = nodeByPath(app.selected);
      $('#detail').innerHTML = '<b>' + esc(n.type) + '</b> ' + esc(U.nodeLabel(n)) +
        ' &middot; <span>' + esc(JSON.stringify(n.props || {})) + '</span>';
    } else {
      $('#detail').textContent = '点击左侧节点查看 props / state';
    }
    document.querySelectorAll('.node-row').forEach(function (r) {
      r.classList.toggle('selected', r.dataset.node === app.selected);
    });
  }

  function populatePresets() {
    $('#preset-select').innerHTML = app.presets.map(function (p) {
      return '<option value="' + esc(p) + '">' + esc(p) + '</option>';
    }).join('');
  }

  async function loadTree() {
    if (bridge) {
      try {
        var data = await bridge.apiGet('tree');
        app.tree = data.tree;
        app.presets = data.presets || Object.keys(U.PRESETS);
      } catch (e) {
        app.tree = JSON.parse(JSON.stringify(U.PRESETS.session));
        app.presets = Object.keys(U.PRESETS);
      }
    } else {
      app.tree = JSON.parse(JSON.stringify(U.PRESETS.session));
      app.presets = Object.keys(U.PRESETS);
    }
    populatePresets();
    render();
  }

  async function loadPreset(name) {
    if (bridge) {
      try {
        var data = await bridge.apiGet('preset', { name: name });
        app.tree = data.tree;
      } catch (e) { toast('载入预设失败'); return; }
    } else {
      app.tree = JSON.parse(JSON.stringify(U.PRESETS[name]));
    }
    app.collapsed.clear(); app.selected = '';
    render();
    toast('已载入预设 ' + name);
  }

  function updateView() {
    $('#preview').hidden = app.view !== 'preview';
    $('#json-pane').hidden = app.view !== 'json';
    $('#view-preview').classList.toggle('active', app.view === 'preview');
    $('#view-json').classList.toggle('active', app.view === 'json');
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      var p = toggle.dataset.toggle;
      if (app.collapsed.has(p)) app.collapsed.delete(p); else app.collapsed.add(p);
      render();
      return;
    }
    var row = e.target.closest('[data-node]');
    if (row) { app.selected = row.dataset.node; render(); return; }
    var tab = e.target.closest('[data-tab]');
    if (tab) { setTabsActive(app.tree, Number(tab.dataset.tab)); render(); return; }
    var btn = e.target.closest('[data-action]');
    if (btn) { toast('已触发 action: ' + btn.dataset.action); return; }
  });

  $('#preset-select').addEventListener('change', function (e) { loadPreset(e.target.value); });
  $('#apply-json').addEventListener('click', async function () {
    try {
      var tree = JSON.parse($('#json-editor').value);
      if (bridge) {
        var r = await bridge.apiPost('tree', { tree: tree });
        app.tree = r.tree;
      } else {
        app.tree = tree;
      }
      app.collapsed.clear(); app.selected = '';
      render();
      toast('已应用新树');
    } catch (err) {
      toast('JSON 无效：' + err.message);
    }
  });
  $('#view-preview').addEventListener('click', function () { app.view = 'preview'; updateView(); });
  $('#view-json').addEventListener('click', function () { app.view = 'json'; updateView(); });

  loadTree().then(function () {
    var preset = new URLSearchParams(location.search).get('preset');
    if (preset && app.presets.indexOf(preset) >= 0) {
      $('#preset-select').value = preset;
      loadPreset(preset);
    }
  });
})();
