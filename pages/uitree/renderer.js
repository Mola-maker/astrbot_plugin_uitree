/* UI Tree renderer —— 抽离自 Claude Code ui.render mod 的元素树渲染。
 * 纯函数：给定一棵 {type,props,state,children} 树，产出
 * 树视图 / 实时预览 / JSON 三种 HTML。无依赖，file:// 可直接运行。
 */
(function (global) {
  'use strict';

  var TYPE_COLORS = {
    Pane: '#8b7cf6', Box: '#5bb8f6', Row: '#5bb8f6', Column: '#5bb8f6',
    Text: '#9aa5b8', Button: '#3ddc97', Badge: '#f6b73c', Progress: '#5bb8f6',
    Stat: '#3ddc97', Tabs: '#8b7cf6', List: '#5bb8f6', ListItem: '#9aa5b8',
    Divider: '#5d6a80', Spacer: '#5d6a80'
  };

  var PRESETS = {
    session: {
      type: 'Pane',
      props: { title: '会话工作台', subtitle: 'autonomous-loop · token-weather · first-mod' },
      state: { running: true },
      children: [{
        type: 'Column', props: { gap: 3 },
        children: [
          { type: 'Row', props: { gap: 2 }, children: [
            { type: 'Stat', props: { label: '工具调用', value: '3', hint: '累计' } },
            { type: 'Stat', props: { label: '上下文', value: '72%', hint: '已用窗口' } },
            { type: 'Stat', props: { label: '耗时', value: '12.4s', hint: '本轮' } }
          ]},
          { type: 'Text', props: { value: 'Autonomous loop 运行中，agent 正在自主推进。', variant: 'heading' } },
          { type: 'Progress', props: { label: '上下文窗口', value: 72 } },
          { type: 'Tabs', props: { tabs: ['树视图', '渲染预览', 'JSON'] }, state: { active: 1 } },
          { type: 'Row', props: { gap: 2 }, children: [
            { type: 'Button', props: { label: '刷新', action: 'refresh', variant: 'primary' } },
            { type: 'Button', props: { label: '暂停', action: 'pause', variant: 'ghost' } },
            { type: 'Badge', props: { label: '运行中', variant: 'ok' } }
          ]}
        ]
      }]
    },
    filetree: {
      type: 'Pane',
      props: { title: '文件树', subtitle: 'filetree mod · agent 读写轨迹' },
      children: [{
        type: 'List', children: [
          { type: 'ListItem', props: { label: 'src/', kind: 'folder', open: true } },
          { type: 'ListItem', props: { label: '  main.py', kind: 'file', status: 'edited' } },
          { type: 'ListItem', props: { label: '  renderer.js', kind: 'file', status: 'written' } },
          { type: 'ListItem', props: { label: 'pages/', kind: 'folder', open: true } },
          { type: 'ListItem', props: { label: '  index.html', kind: 'file', status: 'read' } },
          { type: 'ListItem', props: { label: 'tests/', kind: 'folder', open: false } }
        ]
      }]
    },
    form: {
      type: 'Pane',
      props: { title: '预订航班', subtitle: 'agent 根据用户请求动态生成的表单' },
      children: [{
        type: 'Column', props: { gap: 2 },
        children: [
          { type: 'Text', props: { value: '请确认以下信息，完成后 agent 继续为你预订。', variant: 'body' } },
          { type: 'Text', props: { value: '出发地 · 城市', variant: 'label' } },
          { type: 'Text', props: { value: '上海 (PVG)', variant: 'value' } },
          { type: 'Text', props: { value: '目的地 · 城市', variant: 'label' } },
          { type: 'Text', props: { value: '北京 (PEK)', variant: 'value' } },
          { type: 'Divider', props: {} },
          { type: 'Row', props: { gap: 2 }, children: [
            { type: 'Button', props: { label: '确认预订', action: 'confirm', variant: 'primary' } },
            { type: 'Button', props: { label: '修改信息', action: 'edit', variant: 'secondary' } }
          ]},
          { type: 'Badge', props: { label: '待用户确认', variant: 'warn' } }
        ]
      }]
    }
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nodeLabel(node) {
    var p = node.props || {};
    if (p.label != null && p.label !== '') return p.label;
    if (p.value != null && p.value !== '') return p.value;
    if (p.title != null && p.title !== '') return p.title;
    return node.type;
  }

  function nodeHint(node) {
    var p = node.props || {};
    switch (node.type) {
      case 'Button': case 'Text': case 'Badge': return p.variant || '';
      case 'Tabs': return (p.tabs || []).length + ' tabs';
      case 'Stat': return p.value || '';
      case 'Progress': return (p.value || 0) + '%';
      case 'List': return (node.children || []).length + ' items';
      default: return '';
    }
  }

  function typeBadge(type) {
    var color = TYPE_COLORS[type] || '#9aa5b8';
    return '<span class="type-badge" style="color:' + color + ';border-color:' + color + '44;background:' + color + '14">' + type + '</span>';
  }

  function renderInspector(tree, collapsed) {
    function walk(node, path) {
      var kids = node.children || [];
      var hasKids = kids.length > 0;
      var closed = collapsed.has(path);
      var tw = hasKids
        ? '<span class="tw" data-toggle="' + path + '">' + (closed ? '▸' : '▾') + '</span>'
        : '<span class="tw leaf">·</span>';
      var hint = nodeHint(node);
      var row = '<div class="node-row" data-node="' + path + '">' + tw + typeBadge(node.type) +
        '<span class="node-label">' + esc(nodeLabel(node)) + '</span>' +
        (hint ? '<span class="node-hint">' + esc(hint) + '</span>' : '') + '</div>';
      var html = '<li>' + row;
      if (hasKids && !closed) {
        html += '<ul>' + kids.map(function (c, i) { return walk(c, path ? path + '.' + i : String(i)); }).join('') + '</ul>';
      }
      return html + '</li>';
    }
    return '<div class="tree"><ul>' + walk(tree, '') + '</ul></div>';
  }

  function renderPreview(tree) {
    function kids(node) { return (node.children || []).map(walk).join(''); }
    function walk(node) {
      var p = node.props || {};
      var gap = ' gap-' + (p.gap || 1);
      switch (node.type) {
        case 'Pane':
          return '<section class="pane"><div class="pane-title">' + esc(p.title || '') +
            (p.subtitle ? '<small>' + esc(p.subtitle) + '</small>' : '') +
            '</div><div class="pane-inner flex col gap-3">' + kids(node) + '</div></section>';
        case 'Box':
          return '<div class="flex ' + (p.direction === 'row' ? 'row' : 'col') + gap + '">' + kids(node) + '</div>';
        case 'Row':
          return '<div class="flex row' + gap + '">' + kids(node) + '</div>';
        case 'Column':
          return '<div class="flex col' + gap + '">' + kids(node) + '</div>';
        case 'Text':
          return '<p class="txt ' + (p.variant || 'body') + '">' + esc(p.value || '') + '</p>';
        case 'Button':
          return '<button class="btn ' + (p.variant || 'primary') + '" data-action="' + esc(p.action || '') + '">' + esc(p.label || '') + '</button>';
        case 'Badge':
          return '<span class="badge ' + (p.variant || 'info') + '">' + esc(p.label || '') + '</span>';
        case 'Progress':
          return '<div class="prog"><div class="p-top"><span>' + esc(p.label || '') + '</span><span>' + (p.value || 0) + '%</span></div>' +
            '<div class="p-bar"><div class="p-fill" style="width:' + (p.value || 0) + '%"></div></div></div>';
        case 'Stat':
          return '<div class="stat"><div class="s-label">' + esc(p.label || '') + '</div>' +
            '<div class="s-value">' + esc(p.value || '') + '</div>' +
            (p.hint ? '<div class="s-hint">' + esc(p.hint) + '</div>' : '') + '</div>';
        case 'Tabs': {
          var tabs = p.tabs || [];
          var active = (node.state && node.state.active) || 0;
          return '<div class="tabs">' + tabs.map(function (t, i) {
            return '<button class="tab' + (i === active ? ' active' : '') + '" data-tab="' + i + '">' + esc(t) + '</button>';
          }).join('') + '</div>';
        }
        case 'List':
          return '<ul class="list">' + kids(node) + '</ul>';
        case 'ListItem':
          return '<li class="list-item"><span class="li-kind">' + (p.kind === 'folder' ? '▸' : '·') + '</span>' +
            '<span>' + esc(p.label || '') + '</span>' +
            (p.status ? '<span class="li-status">' + esc(p.status) + '</span>' : '') + '</li>';
        case 'Divider':
          return '<hr class="divider">';
        case 'Spacer':
          return '<div class="spacer"></div>';
        default:
          return '';
      }
    }
    return '<div class="preview">' + walk(tree) + '</div>';
  }

  function renderJson(tree) {
    return JSON.stringify(tree, null, 2);
  }

  global.UItree = {
    TYPE_COLORS: TYPE_COLORS,
    PRESETS: PRESETS,
    esc: esc,
    nodeLabel: nodeLabel,
    nodeHint: nodeHint,
    renderInspector: renderInspector,
    renderPreview: renderPreview,
    renderJson: renderJson
  };
})(typeof window !== 'undefined' ? window : this);
