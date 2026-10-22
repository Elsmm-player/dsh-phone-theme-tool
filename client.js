window.__ModuleLoader__.load({
  id: 'dsh-phone-theme-tool',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useCallback, useEffect, useRef } = React;

    const KEY = 'dsh.chat-bubble-bg.v1';
    const STYLE_ID = 'dsh-chat-bubble-bg-style';
    const OUT_WIDTH = 1080;
    const JPEG_QUALITY = 0.84;

    // Stable hooks from the chat package: every row carries data-chat-flow-kind,
    // and the own-message bubble keeps the "_bubble" suffix of its CSS module class.
    const MINE = 'html[data-bbg] [data-chat-flow-kind="user"] [class*="_bubble"]';
    const AI = 'html[data-bbg] [data-chat-flow-kind="assistant-step"]';
    const HEADER = 'html[data-bbg] [data-slot="conversation.header"] > header';
    const SIDEBAR = 'html[data-bbg] [class*="sidebarCol"]';

    // :is() keeps the group as ONE selector, so "::before" targets both surfaces.
    const FLOW = 'html[data-bbg] :is([data-conversation-scroll],[data-conversation-region])';
    // Blur lives on the scrolling list only: it clips its own overflow, so a
    // scaled, blurred layer cannot creep up into the top bar.
    const SCROLL = 'html[data-bbg] [data-conversation-scroll]';

    const DEFAULTS = {
      on: true,
      bubble: '', bubble2: '', gradient: false, angle: 135,
      text: 'auto', codeText: '', borderColor: '', borderWidth: 0, glass: false, textStroke: false,
      aiBubble: '', aiBubble2: '', aiGradient: false, aiAngle: 135,
      aiText: 'auto', aiCodeText: '', aiBorderColor: '', aiBorderWidth: 0, aiGlass: false, aiTextStroke: false,
      bgColor: '', bgImage: '', bgFit: 'cover', blur: 0,
      glassBlur: 16,
      composerColor: '', composerGlass: false, composerBlur: 16,
      headerColor: '', headerGlass: false, headerBlur: 16,
      sidebarColor: '', sidebarGlass: false, sidebarBlur: 16,
    };

    const BUBBLES = [
      ['DeepSeek 蓝', '#2f6fed'],
      ['墨蓝', '#1e3a8a'],
      ['珊瑚', '#e2566f'],
      ['蜜橘', '#d9822b'],
      ['青竹', '#22a06b'],
      ['紫藤', '#7c5cd6'],
      ['鼠灰', '#5a6577'],
      ['墨黑', '#1f2328'],
    ];

    const BACKGROUNDS = [
      ['深夜蓝', '#0b1220'],
      ['纯黑', '#0a0a0b'],
      ['墨绿', '#0d1f1a'],
      ['暖白', '#f7f4ee'],
      ['雾蓝', '#eef2f8'],
      ['深海渐变', 'linear-gradient(135deg,#0f2027 0%,#203a43 55%,#2c5364 100%)'],
      ['暮色渐变', 'linear-gradient(160deg,#141e30 0%,#243b55 100%)'],
      ['桃霞渐变', 'linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%)'],
    ];

    const FITS = [
      ['铺满', 'cover'],
      ['拉伸', 'fill'],
      ['适应', 'contain'],
      ['平铺', 'repeat'],
    ];

    function read() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return Object.assign({}, DEFAULTS);
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return Object.assign({}, DEFAULTS);
        const cfg = Object.assign({}, DEFAULTS, parsed);
        if (!cfg.bgColor && !cfg.bgImage && typeof parsed.bg === 'string') {
          if (/^url\(/i.test(parsed.bg)) {
            const m = /^url\(["']?(.*?)["']?\)$/i.exec(parsed.bg);
            if (m) cfg.bgImage = m[1];
          } else {
            cfg.bgColor = parsed.bg;
          }
        }
        return cfg;
      } catch (error) {
        return Object.assign({}, DEFAULTS);
      }
    }

    function save(cfg) {
      try {
        localStorage.setItem(KEY, JSON.stringify(cfg));
        return true;
      } catch (error) {
        return false;
      }
    }

    function readableText(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
      if (!m) return '#ffffff';
      const n = parseInt(m[1], 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? '#14161a' : '#ffffff';
    }

    function hexToRgba(hex, alpha) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
      if (!m) return 'rgba(255,255,255,' + alpha + ')';
      const n = parseInt(m[1], 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }

    /** Rough midpoint, used only to pick a readable text colour for gradients. */
    function mixHex(a, b) {
      const pa = /^#?([0-9a-f]{6})$/i.exec(String(a || ''));
      const pb = /^#?([0-9a-f]{6})$/i.exec(String(b || ''));
      if (!pa || !pb) return a || b || '#2f6fed';
      const na = parseInt(pa[1], 16), nb = parseInt(pb[1], 16);
      const r = Math.round((((na >> 16) & 255) + ((nb >> 16) & 255)) / 2);
      const g = Math.round((((na >> 8) & 255) + ((nb >> 8) & 255)) / 2);
      const bl = Math.round(((na & 255) + (nb & 255)) / 2);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
    }

    function fitRules(fit) {
      if (fit === 'fill') return 'background-size:100% 100% !important;background-repeat:no-repeat !important;';
      if (fit === 'contain') return 'background-size:contain !important;background-repeat:no-repeat !important;';
      if (fit === 'repeat') return 'background-size:auto !important;background-repeat:repeat !important;';
      return 'background-size:cover !important;background-repeat:no-repeat !important;';
    }

    /** One bubble layer: fill, optional acrylic, optional outline and text stroke. */
    function bubbleRule(selector, o) {
      if (!o.color && !o.glass && !o.gradient) return '';
      const solid = o.color || '#2f6fed';
      const second = o.color2 || '#5b8cff';
      const gradient = !!o.gradient && !!o.color2;
      const inkBase = gradient ? mixHex(solid, second) : solid;
      const ink = o.text && o.text !== 'auto' ? o.text : readableText(inkBase);
      const angle = Math.max(0, Math.min(360, Number(o.angle) || 135));
      const lines = [];

      if (o.glass) {
        const gb = Math.max(0, Math.min(60, Number(o.glassBlur) || 16));
        lines.push('background:' + (gradient
          ? 'linear-gradient(' + angle + 'deg,' + hexToRgba(solid, 0.42) + ',' + hexToRgba(second, 0.42) + ')'
          : hexToRgba(solid, 0.42)) + ' !important;');
        lines.push('backdrop-filter:blur(' + gb + 'px) saturate(150%) !important;');
        lines.push('-webkit-backdrop-filter:blur(' + gb + 'px) saturate(150%) !important;');
      } else if (gradient) {
        lines.push('background:linear-gradient(' + angle + 'deg,' + solid + ',' + second + ') !important;');
      } else {
        lines.push('background:' + solid + ' !important;');
      }
      lines.push('color:' + ink + ' !important;');

      if (o.codeText) {
        lines.push('__CODE__:' + o.codeText + ':__');
      }

      const width = Number(o.borderWidth) || 0;
      if (width > 0) {
        lines.push('border:' + width + 'px solid ' + (o.border || 'rgba(255,255,255,0.55)') + ' !important;');
      }
      if (o.glass && width <= 0) {
        lines.push('border:1px solid rgba(255,255,255,0.28) !important;');
      }
      return selector + '{' + lines.join('') + '}';
    }

    function buildCss(cfg) {
      const rules = [];

      const mine = bubbleRule(MINE, {
        color: cfg.bubble, color2: cfg.bubble2, gradient: cfg.gradient, angle: cfg.angle,
        text: cfg.text, codeText: cfg.codeText, border: cfg.borderColor, borderWidth: cfg.borderWidth,
        glass: cfg.glass, textStroke: cfg.textStroke, glassBlur: cfg.glassBlur,
      });
      if (mine) {
        rules.push(mine.replace(/__CODE__:([^:]+):__/g, ''));
        // Only inline text takes the bubble colour: pre/code keep their own palette
        // unless the user sets a code colour explicitly.
        rules.push(MINE + ' :is(p,span,li,td,th,strong,em,b,i,a,div,h1,h2,h3,h4,h5,h6,blockquote):not(pre):not(code):not(pre *){color:inherit !important;}');
        if (/__CODE__:([^:]+):__/.test(mine)) {
          const code = /__CODE__:([^:]+):__/.exec(mine)[1];
          rules.push(MINE + ' :is(pre,code),' + MINE + ' pre *{color:' + code + ' !important;}');
        }
        if (cfg.textStroke) rules.push(MINE + ' *{-webkit-text-stroke:0.4px rgba(0,0,0,0.35) !important;}');
      }

      const ai = bubbleRule(AI, {
        color: cfg.aiBubble, color2: cfg.aiBubble2, gradient: cfg.aiGradient, angle: cfg.aiAngle,
        text: cfg.aiText, codeText: cfg.aiCodeText, border: cfg.aiBorderColor, borderWidth: cfg.aiBorderWidth,
        glass: cfg.aiGlass, textStroke: cfg.aiTextStroke, glassBlur: cfg.glassBlur,
      });
      if (ai) {
        const aiBody = ai.replace(/__CODE__:([^:]+):__/g, '');
        rules.push(aiBody.replace('{', '{border-radius:16px !important;padding:10px 13px !important;'));
        rules.push(AI + ' :is(p,span,li,td,th,strong,em,b,i,a,div,h1,h2,h3,h4,h5,h6,blockquote):not(pre):not(code):not(pre *){color:inherit !important;}');
        if (/__CODE__:([^:]+):__/.test(ai)) {
          const code = /__CODE__:([^:]+):__/.exec(ai)[1];
          rules.push(AI + ' :is(pre,code),' + AI + ' pre *{color:' + code + ' !important;}');
        }
        if (cfg.aiTextStroke) rules.push(AI + ' *{-webkit-text-stroke:0.4px rgba(0,0,0,0.35) !important;}');
      }

      if (cfg.composerColor || cfg.composerGlass) {
        const solid = cfg.composerColor || '#1f2328';
        const gb = Math.max(0, Math.min(60, Number(cfg.composerBlur) || 16));
        const parts = [];
        parts.push('background:' + (cfg.composerGlass ? hexToRgba(solid, 0.45) : solid) + ' !important;');
        if (cfg.composerGlass) {
          parts.push('backdrop-filter:blur(' + gb + 'px) saturate(150%) !important;');
          parts.push('-webkit-backdrop-filter:blur(' + gb + 'px) saturate(150%) !important;');
        }
        rules.push('html[data-bbg] [data-composer-card]{' + parts.join('') + '}');
      }

      const surfaces = [
        ['header', HEADER, ''],
        ['sidebar', SIDEBAR, '--dsw-specific-sidebar-fill'],
      ];
      surfaces.forEach(function (entry) {
        const color = cfg[entry[0] + 'Color'];
        if (!color) return;
        const parts = [];
        if (entry[0] === 'header') {
          // Cover the whole top bar in one flat colour, and extend it upward so the
          // status-bar strip above the header is painted too (no seam, no slider).
          parts.push('position:relative !important;');
          parts.push('background:' + color + ' !important;');
          parts.push('box-shadow:0 -96px 0 0 ' + color + ' !important;');
        } else {
          parts.push('background:' + color + ' !important;');
          if (entry[2]) parts.push(entry[2] + ':' + color + ' !important;');
        }
        rules.push(entry[1] + '{' + parts.join('') + '}');
      });

      // Kill the host's own frosted glass on the top bar and sidebar, not just the
      // plugin's: the header ships translucent with a backdrop blur, which is the
      // "eaten chunk" look whenever a photo sits behind it.
      const hdrWrap = 'html[data-bbg] [data-slot="conversation.header"]';
      rules.push(hdrWrap + '{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}');
      rules.push(HEADER + '{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}');
      rules.push(HEADER + ' *{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}');
      rules.push(SIDEBAR + '{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}');

      if (cfg.bgImage) {
        // The photo now sits under the header. The header is translucent and blurs
        // its backdrop by default, which reads as "a chunk of the photo got eaten"
        // — force it opaque and drop its own backdrop-filter.
        const hdr = 'html[data-bbg] [data-slot="conversation.header"]';
        if (cfg.headerColor) {
          rules.push(hdr + '>header{background:' + cfg.headerColor + ' !important;' +
            'backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}');
        } else {
          // The theme surface token can be translucent, so lay it over a solid base:
          // otherwise the blurred photo still shows through the bar.
          rules.push(hdr + '>header{' +
            'background-color:#0b0f16 !important;' +
            'background-image:linear-gradient(var(--dsw-alias-bg-base,#0b0f16),var(--dsw-alias-bg-base,#0b0f16)) !important;' +
            'backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}');
        }
      }

      const blur = Math.max(0, Math.min(30, Number(cfg.blur) || 0));
      if (cfg.bgImage) {
        if (blur > 0.5) {
          // The blurred layer has to live on the region (the scroll container alone
          // does not paint), but without transform: exactly its own box, so it can
          // never creep above the region into the top bar.
          rules.push(FLOW + '{position:relative !important;background-image:none !important;' +
            'background-color:transparent !important;isolation:isolate !important;}');
          rules.push(FLOW + '::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;' +
            'background-image:url("' + cfg.bgImage + '") !important;background-position:center !important;' +
            fitRules(cfg.bgFit) + 'filter:blur(' + blur + 'px) !important;' +
            (cfg.bgColor ? 'background-color:' + cfg.bgColor + ' !important;' : '') + '}');
        } else {
          rules.push(FLOW + '{background-color:' + (cfg.bgColor || 'transparent') + ' !important;' +
            'background-image:url("' + cfg.bgImage + '") !important;background-position:center !important;' +
            fitRules(cfg.bgFit) + '}');
        }
      } else if (cfg.bgColor) {
        rules.push(FLOW + '{background:' + cfg.bgColor + ' !important;}');
      }

      return rules.join('\n');
    }

    function paint(cfg) {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      const active = cfg.on !== false && (
        cfg.bubble || cfg.aiBubble || cfg.glass || cfg.aiGlass || cfg.gradient || cfg.aiGradient ||
        cfg.composerColor || cfg.composerGlass ||
        cfg.headerColor || cfg.sidebarColor ||
        cfg.bgColor || cfg.bgImage || Number(cfg.blur) > 0
      );
      const css = active ? buildCss(cfg) : '';
      if (!css) {
        root.removeAttribute('data-bbg');
        const old = document.getElementById(STYLE_ID);
        if (old) old.remove();
        return;
      }
      root.setAttribute('data-bbg', 'on');
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        (document.head || root).appendChild(style);
      }
      style.textContent = css;
    }

    function chatAspect() {
      const el = document.querySelector('[data-conversation-scroll]')
        || document.querySelector('[data-conversation-region]');
      if (el && el.clientWidth > 0 && el.clientHeight > 0) {
        return el.clientWidth / el.clientHeight;
      }
      return (window.innerWidth || 390) / (window.innerHeight || 844);
    }

    // ---------- style tokens ----------

    const cardStyle = {
      display: 'flex', flexDirection: 'column', gap: '10px',
      padding: '14px', borderRadius: '14px',
      background: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08))',
      border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18))',
    };
    const titleStyle = { fontSize: '13px', fontWeight: 600, opacity: 0.9, letterSpacing: '0.02em' };
    const hintStyle = { fontSize: '12px', lineHeight: 1.5, opacity: 0.6 };
    const gridStyle = {
      display: 'grid', gap: '10px',
      gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
    };
    const swatchBase = {
      height: '46px', minWidth: '46px', borderRadius: '12px', cursor: 'pointer',
      border: '2px solid transparent', padding: 0, touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
    };
    const rowStyle = { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' };
    const inputStyle = {
      flex: '1 1 150px', minHeight: '44px', padding: '0 12px', borderRadius: '12px',
      border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3))',
      background: 'var(--dsw-alias-bg-base, transparent)',
      color: 'var(--dsw-alias-label-primary, inherit)', fontSize: '14px',
    };
    const colorInputStyle = Object.assign({}, swatchBase, {
      width: '52px', background: 'transparent', border: '1px dashed var(--dsw-alias-border-l2,#888)',
    });
    const ghostButton = Object.assign({}, swatchBase, {
      height: '44px', width: 'auto', padding: '0 14px',
      border: '1px solid var(--dsw-alias-border-l2,#888)',
      background: 'transparent', color: 'var(--dsw-alias-label-primary, inherit)',
      fontSize: '13px', fontWeight: 500,
    });

    function Swatches(props) {
      return h('div', { style: gridStyle },
        props.items.map(function (entry) {
          const selected = props.value === entry[1];
          return h('button', {
            key: entry[1], type: 'button', title: entry[0], 'aria-label': entry[0],
            'aria-pressed': selected,
            onClick: function () { props.onPick(entry[1]); },
            style: Object.assign({}, swatchBase, {
              background: entry[1],
              borderColor: selected ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'transparent',
              boxShadow: selected ? '0 0 0 2px var(--dsw-alias-brand-primary, #4d8dff) inset' : 'none',
            }),
          });
        }));
    }

    function Chips(props) {
      return h('div', { style: rowStyle },
        props.items.map(function (entry) {
          const selected = props.value === entry[1];
          return h('button', {
            key: entry[1], type: 'button', 'aria-pressed': selected,
            onClick: function () { props.onPick(entry[1]); },
            style: Object.assign({}, ghostButton, {
              borderColor: selected ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-border-l2,#888)',
              color: selected ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-label-primary, inherit)',
            }),
          }, entry[0]);
        }));
    }

    function Toggle(props) {
      const on = !!props.value;
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': on,
        onClick: function () { props.onChange(!on); },
        style: Object.assign({}, ghostButton, {
          borderColor: on ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-border-l2,#888)',
          color: on ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-label-primary, inherit)',
        }),
      }, props.label + '：' + (on ? '开' : '关'));
    }

    function BubbleCard(props) {
      // "ai" + "bubble" must become "aiBubble", not "aibubble": the stored keys
      // are camelCase, so capitalise the field name after the prefix.
      const keyOf = function (name) {
        if (!props.prefix) return name;
        return props.prefix + name.charAt(0).toUpperCase() + name.slice(1);
      };
      const get = function (name) { return props.cfg[keyOf(name)]; };
      const set = function (name, value) {
        const patch = {};
        patch[keyOf(name)] = value;
        props.update(patch);
      };
      const color = get('bubble');
      const text = get('text');
      const codeText = get('codeText');
      const width = Number(get('borderWidth')) || 0;
      const color2 = get('bubble2');
      const gradient = get('gradient');
      const angle = Number(get('angle')) || 135;
      const ANGLE_CHOICES = [[135, '斜'], [90, '竖'], [180, '横']];

      const group = function (label) {
        return h('div', {
          style: {
            fontSize: '12px', fontWeight: 650, opacity: 0.7,
            marginTop: '4px', letterSpacing: '0.04em',
          },
        }, label);
      };

      return h('div', { style: cardStyle },
        h('div', { style: titleStyle }, props.title),

        group('底色'),
        h(Swatches, {
          items: BUBBLES,
          value: color,
          onPick: function (value) { set('bubble', value); },
        }),
        h('div', { style: rowStyle },
          h('input', {
            type: 'color', 'aria-label': props.title + ' 自定义颜色',
            value: /^#[0-9a-f]{6}$/i.test(color) ? color : '#2f6fed',
            onChange: function (event) { set('bubble', event.target.value); },
            style: colorInputStyle,
          }),
          h('button', {
            type: 'button', style: ghostButton,
            onClick: function () { set('bubble', ''); },
          }, props.noneLabel),
          h(Toggle, {
            label: '渐变', value: gradient,
            onChange: function (value) { set('gradient', value); },
          }),
        ),
        gradient ? h('div', { style: rowStyle },
          h('div', { style: hintStyle }, '第二色'),
          h('input', {
            type: 'color', 'aria-label': '第二种颜色',
            value: /^#[0-9a-f]{6}$/i.test(color2) ? color2 : '#5b8cff',
            onChange: function (event) { set('bubble2', event.target.value); },
            style: colorInputStyle,
          }),
          h('div', { style: rowStyle },
            ANGLE_CHOICES.map(function (entry) {
              const on = angle === entry[0];
              return h('button', {
                key: 'angle-' + entry[0], type: 'button',
                'aria-pressed': on,
                onClick: function () { set('angle', entry[0]); },
                style: Object.assign({}, ghostButton, {
                  borderColor: on ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-border-l2,#888)',
                  color: on ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-label-primary, inherit)',
                }),
              }, entry[1]);
            })),
        ) : null,

        group('文字'),
        h('div', { style: rowStyle },
          h('div', { style: hintStyle }, '常规'),
          h('input', {
            type: 'color', 'aria-label': '常规文字颜色',
            value: /^#[0-9a-f]{6}$/i.test(text) ? text : '#ffffff',
            onChange: function (event) { set('text', event.target.value); },
            style: colorInputStyle,
          }),
          h('button', {
            type: 'button', style: ghostButton,
            onClick: function () { set('text', 'auto'); },
          }, text === 'auto' ? '自动（推荐）' : '回自动'),
        ),
        h('div', { style: rowStyle },
          h('div', { style: hintStyle }, '代码'),
          h('input', {
            type: 'color', 'aria-label': '代码块文字颜色',
            value: /^#[0-9a-f]{6}$/i.test(codeText) ? codeText : '#e6edf3',
            onChange: function (event) { set('codeText', event.target.value); },
            style: colorInputStyle,
          }),
          h('button', {
            type: 'button', style: ghostButton,
            onClick: function () { set('codeText', ''); },
          }, '跟随主题'),
        ),

        group('描边'),
        h('div', { style: rowStyle },
          h('input', {
            type: 'color', 'aria-label': '描边颜色',
            value: /^#[0-9a-f]{6}$/i.test(get('borderColor')) ? get('borderColor') : '#ffffff',
            onChange: function (event) { set('borderColor', event.target.value); },
            style: colorInputStyle,
          }),
          h('input', {
            type: 'range', min: 0, max: 3, step: 1, value: width,
            'aria-label': '描边粗细',
            onChange: function (event) { set('borderWidth', Number(event.target.value)); },
            style: { flex: '1 1 120px', minHeight: '36px' },
          }),
          h('div', { style: hintStyle }, width + 'px'),
        ),

        group('毛玻璃'),
        h('div', { style: rowStyle },
          h(Toggle, {
            label: '毛玻璃', value: get('glass'),
            onChange: function (value) { set('glass', value); },
          }),
          h(Toggle, {
            label: '文字描边', value: get('textStroke'),
            onChange: function (value) { set('textStroke', value); },
          }),
        ),
        get('glass') ? h('div', { style: rowStyle },
          h('div', { style: hintStyle }, '强度'),
          h('input', {
            type: 'range', min: 2, max: 40, step: 1,
            value: Math.round(Number(props.cfg.glassBlur) || 16),
            'aria-label': '毛玻璃强度',
            onChange: function (event) { props.update({ glassBlur: Number(event.target.value) }); },
            style: { flex: '1 1 140px', minHeight: '36px' },
          }),
          h('div', { style: hintStyle }, Math.round(Number(props.cfg.glassBlur) || 16) + 'px'),
        ) : null,

        h('div', { style: rowStyle },
          h('div', {
            style: {
              padding: '8px 12px', borderRadius: '16px', fontSize: '13px',
              background: gradient
                ? (get('glass')
                  ? 'linear-gradient(' + angle + 'deg,' + hexToRgba(color || '#2f6fed', 0.42) + ',' +
                    hexToRgba(color2 || '#5b8cff', 0.42) + ')'
                  : 'linear-gradient(' + angle + 'deg,' + (color || '#2f6fed') + ',' + (color2 || '#5b8cff') + ')')
                : (get('glass') ? hexToRgba(color || '#2f6fed', 0.42) : (color || 'transparent')),
              color: text === 'auto'
                ? readableText(gradient ? mixHex(color || '#2f6fed', color2 || '#5b8cff') : (color || '#2f6fed'))
                : text,
              border: (Number(get('borderWidth')) > 0
                ? Number(get('borderWidth')) + 'px solid ' + (get('borderColor') || 'rgba(255,255,255,0.55)')
                : '1px dashed rgba(127,127,127,0.4)'),
              backdropFilter: get('glass')
                ? 'blur(' + Math.round(Number(props.cfg.glassBlur) || 16) + 'px) saturate(150%)'
                : 'none',
              WebkitBackdropFilter: get('glass')
                ? 'blur(' + Math.round(Number(props.cfg.glassBlur) || 16) + 'px) saturate(150%)'
                : 'none',
            },
          }, '示例气泡')),
      );
    }

    function CoverCropper(props) {
      const canvasRef = useRef(null);
      const imageRef = useRef(null);
      const dragRef = useRef(null);
      const [ready, setReady] = useState(false);
      const [zoom, setZoom] = useState(1);
      const [pan, setPan] = useState({ x: 0, y: 0 });

      const targetHeight = Math.min(1600, Math.max(160, Math.round(OUT_WIDTH / props.aspect)));
      const targetWidth = Math.max(160, Math.round(targetHeight * props.aspect));

      const draw = function (level, spot) {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        const z = level === undefined ? zoom : level;
        const p = spot === undefined ? pan : spot;
        const cover = Math.max(W / image.naturalWidth, H / image.naturalHeight);
        const scale = cover * z;
        const dw = image.naturalWidth * scale;
        const dh = image.naturalHeight * scale;
        const slackX = Math.max(0, dw - W);
        const slackY = Math.max(0, dh - H);
        const dx = -slackX * (0.5 + 0.5 * p.x);
        const dy = -slackY * (0.5 + 0.5 * p.y);
        ctx.drawImage(image, dx, dy, dw, dh);
      };

      useEffect(function () {
        const image = new Image();
        image.onload = function () {
          imageRef.current = image;
          setReady(true);
        };
        image.src = props.src;
        return function () { imageRef.current = null; };
      }, [props.src]);

      useEffect(function () { if (ready) draw(zoom, pan); }, [ready, zoom, pan.x, pan.y]);

      const onDown = function (event) {
        dragRef.current = { x: event.clientX, y: event.clientY };
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      };

      const onMove = function (event) {
        if (!dragRef.current) return;
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return;
        const rect = canvas.getBoundingClientRect();
        const k = canvas.width / Math.max(1, rect.width);
        const dxCss = event.clientX - dragRef.current.x;
        const dyCss = event.clientY - dragRef.current.y;
        dragRef.current = { x: event.clientX, y: event.clientY };

        const cover = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        const scale = cover * zoom;
        const slackX = Math.max(1, image.naturalWidth * scale - canvas.width);
        const slackY = Math.max(1, image.naturalHeight * scale - canvas.height);

        setPan(function (prev) {
          return {
            x: Math.max(-1, Math.min(1, prev.x - (dxCss * k * 2) / slackX)),
            y: Math.max(-1, Math.min(1, prev.y - (dyCss * k * 2) / slackY)),
          };
        });
      };

      const onUp = function () { dragRef.current = null; };

      const apply = function () {
        const canvas = canvasRef.current;
        if (!canvas) { props.onCancel(); return; }
        try {
          props.onDone(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (error) {
          props.onError('导出失败，换张图试试。');
        }
      };

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('div', {
          style: {
            position: 'relative', borderRadius: '12px', overflow: 'hidden',
            background: '#000', touchAction: 'none', userSelect: 'none',
          },
        },
          h('canvas', {
            ref: canvasRef,
            width: targetWidth,
            height: targetHeight,
            onPointerDown: onDown,
            onPointerMove: onMove,
            onPointerUp: onUp,
            onPointerCancel: onUp,
            style: { display: 'block', width: '100%', height: 'auto', touchAction: 'none' },
          }),
          h('div', {
            style: {
              position: 'absolute', inset: '0', pointerEvents: 'none',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)', borderRadius: '12px',
            },
          })),
        h('div', { style: hintStyle }, '框就是背景的实际比例（' + props.aspect.toFixed(2) + ':1）。拖动挪位置，滑条缩放，框里看到的就会被留下。'),
        h('input', {
          type: 'range', min: 1, max: 3, step: 0.01, value: zoom,
          'aria-label': '缩放',
          onChange: function (event) { setZoom(Number(event.target.value)); },
          style: { width: '100%', minHeight: '36px' },
        }),
        h('div', { style: rowStyle },
          h('button', { type: 'button', style: ghostButton, onClick: apply }, '用这块当背景'),
          h('button', {
            type: 'button', style: ghostButton,
            onClick: function () { setZoom(1); setPan({ x: 0, y: 0 }); },
          }, '复位'),
          h('button', { type: 'button', style: ghostButton, onClick: props.onCancel }, '取消'),
        ));
    }

    /** 顶栏 / 侧边栏 / 输入框共用的一套控制；输入框多一组毛玻璃。 */
    function SurfaceCard(props) {
      const key = function (name) {
        return props.prefix + name.charAt(0).toUpperCase() + name.slice(1);
      };
      const color = props.cfg[key('color')];
      const withGlass = props.withGlass === true;
      const glass = props.cfg[key('glass')];
      const strength = Math.round(Number(props.cfg[key('blur')]) || 16);

      const set = function (name, value) {
        const patch = {};
        patch[key(name)] = value;
        props.update(patch);
      };

      return h('div', { style: cardStyle },
        h('div', { style: titleStyle }, props.title),
        h(Swatches, {
          items: BUBBLES, value: color,
          onPick: function (value) { set('color', value); },
        }),
        h('div', { style: rowStyle },
          h('input', {
            type: 'color', 'aria-label': props.title + '颜色',
            value: /^#[0-9a-f]{6}$/i.test(color) ? color : '#1b1f27',
            onChange: function (event) { set('color', event.target.value); },
            style: colorInputStyle,
          }),
          h('button', {
            type: 'button', style: ghostButton,
            onClick: function () { set('color', ''); },
          }, '用回默认色'),
          withGlass ? h(Toggle, {
            label: '毛玻璃', value: glass,
            onChange: function (value) { set('glass', value); },
          }) : null,
        ),
        withGlass && glass ? h('div', { style: rowStyle },
          h('div', { style: hintStyle }, '强度'),
          h('input', {
            type: 'range', min: 2, max: 40, step: 1, value: strength,
            'aria-label': props.title + '毛玻璃强度',
            onChange: function (event) { set('blur', Number(event.target.value)); },
            style: { flex: '1 1 140px', minHeight: '36px' },
          }),
          h('div', { style: hintStyle }, strength + 'px'),
        ) : null,
        h('div', { style: rowStyle },
          h('button', {
            type: 'button', style: ghostButton,
            onClick: function () {
              // One combined patch: separate update() calls would each rebuild
              // from the same stale snapshot and only the last would survive.
              const patch = {};
              patch[key('color')] = '';
              if (withGlass) {
                patch[key('glass')] = false;
                patch[key('blur')] = 16;
              }
              props.update(patch);
            },
          }, '恢复默认'),
        ));
    }

    /** 预设：只在本机保存与切换，不做导出分享。 */
    function PresetPanel(props) {
      const PRESET_KEY = 'dsh.chat-bubble-bg.presets.v1';
      const [name, setName] = useState('');
      const [, setTick] = useState(0);
      const [status, setStatus] = useState('');

      const load = function () {
        try {
          const raw = localStorage.getItem(PRESET_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
          return {};
        }
      };
      const store = function (value) {
        try {
          localStorage.setItem(PRESET_KEY, JSON.stringify(value));
          return true;
        } catch (error) {
          return false;
        }
      };

      const presets = load();
      const names = Object.keys(presets).sort(function (a, b) {
        return (presets[b].savedAt || 0) - (presets[a].savedAt || 0);
      });

      const saveCurrent = function () {
        const key = (name || '').trim() || ('预设 ' + new Date().toLocaleString());
        const next = load();
        next[key] = { savedAt: Date.now(), cfg: props.cfg };
        if (!store(next)) { setStatus('存不下，删几个旧的再试。'); return; }
        setTick(function (v) { return v + 1; });
        setName('');
        setStatus('已保存：' + key);
      };

      const remove = function (key) {
        const next = load();
        delete next[key];
        store(next);
        setTick(function (v) { return v + 1; });
        setStatus('已删除：' + key);
      };

      const apply = function (key) {
        const item = presets[key];
        if (!item || !item.cfg) return;
        props.onApply(item.cfg);
        setStatus('已应用：' + key);
      };

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        h('div', { style: cardStyle },
          h('div', { style: titleStyle }, '保存当前'),
          h('div', { style: rowStyle },
            h('input', {
              type: 'text', placeholder: '预设名字（可空）', value: name,
              onChange: function (event) { setName(event.target.value); },
              style: inputStyle,
            }),
            h('button', { type: 'button', style: ghostButton, onClick: saveCurrent }, '保存'),
          )),

        names.length ? h('div', { style: cardStyle },
          h('div', { style: titleStyle }, '已保存（' + names.length + '）'),
          names.map(function (key) {
            return h('div', { key: key, style: rowStyle },
              h('div', { style: { flex: '1 1 120px', fontSize: '13px' } }, key),
              h('button', { type: 'button', style: ghostButton, onClick: function () { apply(key); } }, '应用'),
              h('button', { type: 'button', style: ghostButton, onClick: function () { remove(key); } }, '删'),
            );
          })) : h('div', { style: hintStyle }, '还没有保存过预设。'),

        status ? h('div', { style: hintStyle }, status) : null,
      );
    }

    function Section() {
      const [cfg, setCfg] = useState(read);
      const [notice, setNotice] = useState('');
      const [pending, setPending] = useState(null);
      const [tab, setTab] = useState('bubble');
      const fileRef = useRef(null);

      useEffect(function () { paint(cfg); }, [cfg]);

      const update = useCallback(function (patch) {
        const next = Object.assign({}, cfg, patch);
        setCfg(next);
        if (!save(next)) setNotice('这张图太大了，存不下。换张小一点的，或者把「显示方式」改成拉伸再截一次。');
        paint(next);
      }, [cfg]);

      const onFile = function (event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (!/^image\//.test(file.type)) { setNotice('这个不是图片。'); return; }
        setNotice('');
        const reader = new FileReader();
        reader.onload = function () {
          setPending({ src: String(reader.result || ''), aspect: chatAspect() });
        };
        reader.onerror = function () { setNotice('读不出来这张图。'); };
        reader.readAsDataURL(file);
      };

      const applyCfg = function (incoming) {
        const next = Object.assign({}, DEFAULTS, incoming, { on: true });
        setCfg(next);
        save(next);
        paint(next);
        setNotice('');
      };

      const TABS = [['bubble', '气泡'], ['chrome', '界面'], ['bg', '背景'], ['preset', '预设']];

      const tabBar = h('div', { style: { display: 'flex', gap: '8px' } },
        TABS.map(function (entry) {
          const on = tab === entry[0];
          return h('button', {
            key: entry[0], type: 'button',
            'aria-pressed': on,
            onClick: function () { setTab(entry[0]); },
            style: Object.assign({}, ghostButton, {
              flex: '1 1 0',
              borderColor: on ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-border-l2,#888)',
              color: on ? 'var(--dsw-alias-brand-primary, #4d8dff)' : 'var(--dsw-alias-label-primary, inherit)',
            }),
          }, entry[1]);
        }));

      const bubbleTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        h(BubbleCard, {
          cfg: cfg, update: update, prefix: '',
          title: '我的气泡',
          hint: '自己发出去的消息。',
          noneLabel: '不要气泡',
        }),
        h(BubbleCard, {
          cfg: cfg, update: update, prefix: 'ai',
          title: '你的气泡',
          hint: '人家回复外面那层。',
          noneLabel: '不要气泡',
        }));

      const chromeTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        h(SurfaceCard, {
          cfg: cfg, update: update, prefix: 'composer', withGlass: true,
          title: '输入框',
          hint: '打字那块底板，可以单独开毛玻璃。',
        }),
        h(SurfaceCard, {
          cfg: cfg, update: update, prefix: 'header',
          title: '顶栏',
          hint: '最上面那条标题栏，只改颜色。',
        }),
        h(SurfaceCard, {
          cfg: cfg, update: update, prefix: 'sidebar',
          title: '侧边栏',
          hint: '左边选工作区和会话那一列，只改颜色。',
        }));

      const bgTab = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        h('div', { style: cardStyle },
          h('div', { style: titleStyle }, '聊天背景'),
          h(Swatches, {
            items: BACKGROUNDS,
            value: cfg.bgImage ? '' : cfg.bgColor,
            onPick: function (value) { update({ bgColor: value, bgImage: '' }); },
          }),

          h('div', { style: { height: '1px', background: 'var(--dsw-alias-border-l1, rgba(127,127,127,0.18))', margin: '2px 0' } }),

          h('div', { style: titleStyle }, '自己的图片'),
          h('div', { style: rowStyle },
            h('input', { ref: fileRef, type: 'file', accept: 'image/*', onChange: onFile, style: { display: 'none' } }),
            h('button', {
              type: 'button', style: ghostButton,
              onClick: function () { if (fileRef.current) fileRef.current.click(); },
            }, cfg.bgImage ? '换一张' : '从本地选图'),
            h('input', {
              type: 'url', inputMode: 'url', placeholder: '或填图片地址 https://…',
              'aria-label': '背景图片地址',
              onKeyDown: function (event) {
                if (event.key !== 'Enter') return;
                const url = event.currentTarget.value.trim();
                if (url) update({ bgImage: url, bgColor: '' });
              },
              style: inputStyle,
            }),
          ),

          pending ? h(CoverCropper, {
            src: pending.src,
            aspect: pending.aspect,
            onCancel: function () { setPending(null); },
            onError: function (message) { setPending(null); setNotice(message); },
            onDone: function (url) {
              setPending(null);
              update({ bgImage: url || '', bgColor: '', bgFit: 'cover' });
            },
          }) : null,

          cfg.bgImage ? h('div', { style: rowStyle },
            h('div', { style: hintStyle }, '显示方式'),
            h(Chips, { items: FITS, value: cfg.bgFit, onPick: function (fit) { update({ bgFit: fit }); } }),
            h('button', { type: 'button', style: ghostButton, onClick: function () { update({ bgImage: '' }); } }, '去掉图片'),
          ) : null,

          cfg.bgImage ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('div', { style: rowStyle },
              h('div', { style: hintStyle }, '背景模糊'),
              h('input', {
                type: 'range', min: 0, max: 24, step: 1, value: Math.round(Number(cfg.blur) || 0),
                'aria-label': '背景模糊',
                onChange: function (event) { update({ blur: Number(event.target.value) }); },
                style: { flex: '1 1 140px', minHeight: '36px' },
              }),
              h('div', { style: hintStyle }, (Math.round(Number(cfg.blur) || 0)) + 'px'),
            ),
          ) : null,

          h('div', { style: rowStyle },
            h('button', {
              type: 'button', style: ghostButton,
              onClick: function () { update({ bgColor: '', bgImage: '', blur: 0 }); },
            }, '清掉背景'),
          )),

        h('button', {
          type: 'button',
          onClick: function () {
            const reset = Object.assign({}, DEFAULTS);
            setCfg(reset);
            save(reset);
            paint(reset);
            setPending(null);
            setNotice('');
          },
          style: {
            alignSelf: 'flex-start', minHeight: '44px', padding: '0 18px',
            borderRadius: '12px', cursor: 'pointer', touchAction: 'manipulation',
            border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3))',
            background: 'transparent',
            color: 'var(--dsw-alias-state-error-primary, #e2566f)',
            fontSize: '13px',
          },
        }, '全部恢复默认'));

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 2px 24px' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          h('div', { style: { fontSize: '16px', fontWeight: 650 } }, '气泡与背景')),

        notice ? h('pre', {
          style: {
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: '240px', overflow: 'auto',
            fontSize: '12px', lineHeight: 1.5, padding: '10px 12px', borderRadius: '10px',
            background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary,#d9822b) 16%, transparent)',
            color: 'var(--dsw-alias-label-primary, inherit)',
          },
        }, notice) : null,


        tabBar,
        tab === 'bubble' ? bubbleTab : null,
        tab === 'chrome' ? chromeTab : null,
        tab === 'bg' ? bgTab : null,
        tab === 'preset' ? h(PresetPanel, { cfg: cfg, onApply: applyCfg }) : null,
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(function () {
          paint(read());
          const onStorage = function (event) {
            if (event.key === KEY) paint(read());
          };
          window.addEventListener('storage', onStorage);
          return function () { window.removeEventListener('storage', onStorage); };
        });

        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register({
            name: 'settings.section',
            id: 'chat-bubble-bg',
            order: 40,
            label: function () { return '气泡与背景'; },
          }, Section);
        });
      },
    };
  },
});
