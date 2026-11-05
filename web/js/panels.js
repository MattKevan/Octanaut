"use strict";
var OctanautPanels = (() => {
  // node_modules/preact/dist/preact.mjs
  var n;
  var t;
  var r;
  var i;
  var u;
  var f;
  var e;
  var o;
  var l;
  var c;
  var a;
  var s;
  var h = /* @__PURE__ */ Symbol.for("pv");
  var p = {};
  var v = [];
  var y = /^m(i|n|o|s|text|space)$/;
  var w = Array.isArray;
  var d = v.slice;
  var _ = Object.assign;
  function g(n2) {
    n2 && n2.parentNode && n2.remove();
  }
  function m(r3, i3, u3, f4, e3) {
    var o4 = { type: r3, props: i3, key: u3, ref: f4, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: h, __v: e3 || ++t, __i: -1, __u: 0 };
    return !e3 && n.vnode && n.vnode(o4), o4;
  }
  function M(n2) {
    return n2.children;
  }
  function x(n2, t3) {
    this.props = n2, this.context = t3, this.__g = 0;
  }
  function S(n2, t3) {
    if (null == t3) return n2.__ && S(n2.__, n2.__i + 1);
    for (var r3; t3 < n2.__k.length; t3++) if ((r3 = n2.__k[t3]) && r3.__e) return r3.__e;
    return "function" != typeof n2.type || n2.props.__P ? null : S(n2);
  }
  function C(n2) {
    if ((n2 = n2.__) && n2.__c && !n2.props.__P) return n2.__e = null, n2.__k.some(function(t3) {
      return t3 && (n2.__e = t3.__e);
    }), C(n2);
  }
  function j(t3) {
    (8 & t3.__g || (t3.__g |= 8, i.push(t3), f++)) && u == n.debounceRendering || ((u = n.debounceRendering) || queueMicrotask)(L);
  }
  function L() {
    var t3, r3, o4, l3, c3, a4, s3, p3, v3;
    try {
      for (r3 = 1; i.length; ) i.length > r3 && i.sort(e), t3 = i.shift(), r3 = i.length, 8 & t3.__g && (l3 = void 0, c3 = void 0, a4 = (c3 = (o4 = t3).__v).__e, s3 = [], p3 = [], (v3 = o4.__P) && ((l3 = _({ constructor: h }, c3)).__v = c3.__v + 1, n.vnode && n.vnode(l3), V(v3, l3, c3, o4.__n, v3.namespaceURI, 32 & c3.__u ? [a4] : null, s3, a4 || S(c3), 32 & c3.__u, p3), l3.__v = c3.__v, l3.__.__k[l3.__i] = l3, D(s3, l3, p3), c3.__ = c3.__e = null, l3.__e != a4 && C(l3)));
    } finally {
      (f = i.length) && (u || queueMicrotask)(L);
    }
  }
  function H(n2, t3, r3, i3, u3, f4, e3, o4, l3, c3, a4) {
    var s3, h3, y3, w3, d3, _3, g3 = i3.__k || v, k2 = t3.length;
    for (l3 = I(r3, t3, g3, l3, k2), s3 = 0; s3 < k2; s3++) null != (y3 = r3.__k[s3]) && (h3 = ~y3.__i && g3[y3.__i] || p, y3.__i = s3, _3 = V(n2, y3, h3, u3, f4, e3, o4, l3, c3, a4), w3 = y3.__e, (h3.ref != y3.ref || 8 & h3.__u) && (h3.ref && F(h3.ref, null, y3, h3), y3.ref && a4.push(y3.ref, y3.__c || w3, y3)), d3 = d3 || w3, 4 & y3.__u ? (l3 = q(y3, l3, n2, !h3.__v), h3.__e && (h3.__e = null)) : "function" == typeof y3.type && void 0 !== _3 ? l3 = _3 : w3 && (l3 = w3.nextSibling), y3.__u &= -21);
    return r3.__e = d3, l3;
  }
  function I(n2, t3, r3, i3, u3) {
    var f4, e3, o4, l3, c3, a4, s3, p3, v3, y3 = r3.length, d3 = y3, _3 = 0, g3 = 0, k2 = n2.__k = Array(u3);
    for (f4 = 0; f4 < u3; f4++) null != (e3 = t3[f4]) && "boolean" != typeof e3 && "function" != typeof e3 ? ("object" != typeof e3 || e3.constructor === String ? e3 = k2[f4] = m(null, e3) : w(e3) ? e3 = k2[f4] = m(M, { children: e3 }) : e3.constructor === h && e3.__b ? e3 = k2[f4] = m(e3.type, e3.props, e3.key, e3.ref, e3.__v) : k2[f4] = e3, l3 = f4 + _3, e3.__ = n2, e3.__b = n2.__b + 1, o4 = null, ~(c3 = e3.__i = O(e3, r3, l3, d3)) && (d3--, (o4 = r3[c3]) && (o4.__u |= 2)), o4 && o4.__v ? (e3.__u |= 16, c3 == l3 - 1 ? _3-- : c3 == l3 + 1 ? _3++ : c3 != l3 && (c3 > l3 ? _3-- : _3++, g3 = 1)) : (~c3 || (u3 > y3 ? _3-- : u3 < y3 && _3++), "function" != typeof e3.type && (e3.__u |= 4))) : k2[f4] = null;
    if (g3) {
      for (a4 = [], s3 = [], f4 = 0; f4 < u3; f4++) if ((e3 = k2[f4]) && 16 & e3.__u) {
        for (_3 = 0, p3 = a4.length; _3 < p3; ) a4[v3 = _3 + p3 >> 1] < e3.__i ? _3 = v3 + 1 : p3 = v3;
        a4[_3] = e3.__i, s3[f4] = _3 + 1;
      }
      for (_3 = a4.length; f4--; ) s3[f4] && (s3[f4] == _3 ? _3-- : k2[f4].__u |= 4);
    }
    if (d3) for (f4 = 0; f4 < y3; f4++) !(o4 = r3[f4]) || 2 & o4.__u || (o4.__e == i3 && (i3 = S(o4)), G(o4, o4));
    return i3;
  }
  function q(n2, t3, r3, i3) {
    var u3, f4, e3, o4;
    if ("function" == typeof n2.type) {
      if (n2.props.__P) return t3;
      if (u3 = n2.__k) for (f4 = 0; f4 < u3.length; f4++) u3[f4] && (u3[f4].__ = n2, t3 = q(u3[f4], t3, r3, false));
      return t3;
    }
    for (t3 && !t3.parentNode && (t3 = S(n2)) && !t3.parentNode && (t3 = null), e3 = n2.__e, o4 = t3; o4 && 8 == o4.nodeType; ) o4 = o4.nextSibling;
    for (e3 != o4 && (!i3 && r3.moveBefore && e3.parentNode ? r3.moveBefore(e3, t3) : r3.insertBefore(e3, t3 || null)), t3 = e3; (t3 = t3 && t3.nextSibling) && 8 == t3.nodeType && !t3.data.startsWith("$s"); ) ;
    return t3;
  }
  function O(n2, t3, r3, i3) {
    var u3, f4 = n2.key, e3 = n2.type, o4 = t3[r3], l3 = o4 && !(2 & o4.__u);
    if (null === o4 && null == f4 || l3 && f4 == o4.key && e3 == o4.type) return r3;
    if (i3 > (l3 ? 1 : 0)) {
      for (u3 = r3 - 1; u3 >= 0; u3--) if ((o4 = t3[u3]) && !(2 & o4.__u) && f4 == o4.key && e3 == o4.type) return u3;
      for (u3 = r3 + 1; u3 < t3.length; u3++) if ((o4 = t3[u3]) && !(2 & o4.__u) && f4 == o4.key && e3 == o4.type) return u3;
    }
    return -1;
  }
  function P(n2, t3, r3) {
    null == r3 && (r3 = ""), "-" == t3[0] ? n2.setProperty(t3, r3) : n2[t3] = r3;
  }
  function T(n2, t3, r3, i3, u3) {
    var f4, e3;
    if ("style" == t3) if ("string" == typeof r3) n2.style.cssText = r3;
    else {
      if ("string" == typeof i3 && (n2.style.cssText = i3 = ""), i3) for (t3 in i3) r3 && t3 in r3 || P(n2.style, t3);
      if (r3) for (t3 in r3) i3 && r3[t3] == i3[t3] || P(n2.style, t3, r3[t3]);
    }
    else if ("o" == t3[0] && "n" == t3[1]) (n2.__e || (n2.__e = {}))[t3] = r3, r3 && i3 || (e3 = a[t3] || (a[t3] = N(t3)), (n2.__a || (n2.__a = {}))[t3] = c, f4 = t3 != (t3 = t3.replace(l, "$1")), (t3 = t3.slice(2))[0] < "a" && (t3 = t3.toLowerCase()), r3 ? n2.addEventListener(t3, e3, f4) : n2.removeEventListener(t3, e3, f4));
    else {
      if ("http://www.w3.org/2000/svg" == u3) t3 = t3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if ("width" != t3 && "height" != t3 && "href" != t3 && "list" != t3 && "form" != t3 && "tabIndex" != t3 && "download" != t3 && "rowSpan" != t3 && "colSpan" != t3 && "role" != t3 && "popover" != t3 && t3 in n2) try {
        return void (n2[t3] = null == r3 ? "" : r3);
      } catch (n3) {
      }
      if ("function" == typeof r3) return;
      null == r3 || false === r3 && "-" != t3[4] ? n2.removeAttribute(t3) : n2.setAttribute(t3, "popover" == t3 && 1 == r3 ? "" : r3);
    }
  }
  function N(t3) {
    return function(r3) {
      var i3 = this.__e;
      if (i3) {
        if (i3 = i3[t3], null == r3[o]) r3[o] = c++;
        else if (r3[o] < this.__a[t3]) return;
        return i3(n.event ? n.event(r3) : r3);
      }
    };
  }
  function V(t3, r3, i3, u3, f4, e3, o4, l3, c3, a4) {
    var s3, p3, y3, d3, k2, b, m3, $, C3, j2, L3, I2, q2, A2, O2, P2, T4, N3, V2 = r3.type;
    if (r3.constructor !== h) return null;
    128 & i3.__u && (c3 = 32 & i3.__u, s3 = i3.__c.__z) && (r3.__u |= c3, p3 = e3 = [], 8 == s3.nodeType ? l3 = z(s3, e3) : e3.push(s3), l3 = e3[0] || l3), (s3 = n.__b) && s3(r3);
    n: if ("function" == typeof V2) {
      y3 = o4.length;
      try {
        if ($ = r3.props, C3 = (s3 = V2.prototype) && s3.render, j2 = (s3 = V2.contextType) && u3[s3.__c], L3 = s3 ? j2 ? j2.props.value : s3.__ : u3, (d3 = i3.__c) ? (r3.__c = d3, 2 & d3.__g && (d3.__g |= 1)) : (C3 ? r3.__c = d3 = new V2($, L3) : (r3.__c = d3 = new x($, L3), d3.constructor = V2, d3.render = J), j2 && j2.sub(d3), d3.state || (d3.state = {}), d3.__n = u3, d3.__g |= 8, d3.__h = [], d3.__k = []), C3 && (d3.__s || (d3.__s = d3.state), V2.getDerivedStateFromProps && (d3.__s == d3.state && (d3.__s = _({}, d3.__s)), _(d3.__s, V2.getDerivedStateFromProps($, d3.__s)))), k2 = d3.props, b = d3.state, d3.__v = r3, i3.__c) {
          if ($ !== k2 && C3 && !V2.getDerivedStateFromProps && d3.componentWillReceiveProps && d3.componentWillReceiveProps($, L3), r3.__v == i3.__v && !(8 & d3.__g) || !(4 & d3.__g) && d3.shouldComponentUpdate && false === d3.shouldComponentUpdate($, d3.__s, L3)) {
            r3.__v != i3.__v && (d3.props = $, d3.state = d3.__s, d3.__g &= -9), r3.__e = i3.__e, r3.__k = i3.__k, r3.__k.some(function(n2) {
              n2 && (n2.__ = r3);
            }), v.push.apply(d3.__h, d3.__k), d3.__k = [], d3.__h.length && o4.push(d3), l3 = S(i3);
            break n;
          }
          d3.componentWillUpdate && d3.componentWillUpdate($, d3.__s, L3), C3 && d3.componentDidUpdate && d3.__h.push(function() {
            d3.componentDidUpdate(k2, b, m3);
          });
        } else C3 && !V2.getDerivedStateFromProps && d3.componentWillMount && d3.componentWillMount(), C3 && d3.componentDidMount && d3.__h.push(d3.componentDidMount);
        if (d3.context = L3, d3.props = $, d3.__P = t3, d3.__g &= -5, I2 = n.__r, q2 = 0, C3) d3.state = d3.__s, d3.__g &= -9, I2 && I2(r3), s3 = d3.render(d3.props, d3.state, d3.context), v.push.apply(d3.__h, d3.__k), d3.__k = [];
        else do {
          d3.__g &= -9, I2 && I2(r3), s3 = d3.render(d3.props, d3.state, d3.context), d3.state = d3.__s;
        } while (8 & d3.__g && ++q2 < 25);
        d3.state = d3.__s, d3.getChildContext && (u3 = _({}, u3, d3.getChildContext())), C3 && i3.__c && d3.getSnapshotBeforeUpdate && (m3 = d3.getSnapshotBeforeUpdate(k2, b)), A2 = s3 && s3.type === M && null == s3.key ? s3.props.children : s3, $.__P && (s3 = l3, f4 = (t3 = $.__P).namespaceURI, c3 = e3 = null, i3.props && i3.props.__P != t3 && (i3.__k.some(function(n2) {
          n2 && G(n2, n2);
        }), i3.__k = null), l3 = i3.__k ? S(i3, 0) : null), l3 = H(t3, w(A2) ? A2 : [A2], r3, i3, u3, f4, e3, o4, l3, c3, a4), $.__P && (r3.__e = null, l3 = s3), r3.__u &= -161, p3 && p3.some(g), d3.__h.length && o4.push(d3), 1 & d3.__g && (d3.__g &= -4);
      } catch (t4) {
        if (o4.length = y3, r3.__v = null, c3 || e3) if (t4.then) {
          if (O2 = 0, r3.__u |= 128 | c3, e3) {
            for (~(T4 = e3.indexOf(l3 || void 0)) || (T4 = e3.length); (N3 = e3[T4 - 1]) && 8 == N3.nodeType; ) T4--;
            for (; T4 < e3.length; T4++) if (N3 = e3[T4]) {
              if (e3[T4] = null, 8 == N3.nodeType) {
                if (N3.data.startsWith("$s")) O2++ || (P2 = N3);
                else if (O2 && N3.data.startsWith("/$s") && !--O2) break;
              } else if (!O2) break;
            }
          }
          if (!P2) {
            for (; l3 && 8 == l3.nodeType && l3.nextSibling; ) l3 = l3.nextSibling;
            P2 = l3;
          }
          (s3 = z(P2 = r3.__c.__z || (r3.__c.__z = P2))) ? (r3.__e = P2, l3 = s3) : r3.__e = l3, l3 = l3 && l3.nextSibling;
        } else e3 && e3.some(g);
        else r3.__e = i3.__e;
        r3.__k || (r3.__k = i3.__k || []), t4.then || B(r3), n.__e(t4, r3, i3);
      }
    } else l3 = r3.__e = E(i3.__e, r3, i3, u3, f4, e3, o4, c3, a4, t3);
    return (s3 = n.diffed) && s3(r3), l3;
  }
  function z(n2, t3) {
    if (n2 && 8 == n2.nodeType && n2.data.startsWith("$s")) for (var r3 = 1; n2 = n2.nextSibling; ) {
      if (8 == n2.nodeType) {
        if (n2.data.startsWith("$s")) r3++;
        else if (n2.data.startsWith("/$s") && !--r3) return n2;
      }
      t3 && t3.push(n2);
    }
  }
  function B(n2) {
    n2 && (n2.__c && (n2.__c.__g |= 4), n2.__k && n2.__k.some(B));
  }
  function D(t3, r3, i3) {
    for (var u3 = 0; u3 < i3.length; ) F(i3[u3++], i3[u3++], i3[u3++]);
    n.__c && n.__c(r3, t3), t3.some(function(r4) {
      try {
        t3 = r4.__h, r4.__h = [], t3.some(function(n2) {
          n2.call(r4);
        });
      } catch (t4) {
        n.__e(t4, r4.__v);
      }
    });
  }
  function E(t3, r3, i3, u3, f4, e3, o4, l3, c3, a4) {
    var s3, h3, v3, _3, k2, b, m3, $, M2, x2 = i3.props || p, C3 = r3.props, j2 = r3.type;
    if ("svg" == j2 ? f4 = "http://www.w3.org/2000/svg" : "math" == j2 ? f4 = "http://www.w3.org/1998/Math/MathML" : f4 || (f4 = "http://www.w3.org/1999/xhtml"), e3) {
      for (s3 = 0; s3 < e3.length; s3++) if ((k2 = e3[s3]) && (j2 ? k2.localName == j2 : 3 == k2.nodeType)) {
        t3 = k2, e3[s3] = null;
        break;
      }
    }
    if (!t3) {
      if ($ = a4.ownerDocument || document, !j2) return $.createTextNode(C3);
      t3 = $.createElementNS(f4, j2, C3.is && C3), l3 && (n.__m && n.__m(r3, e3), l3 = false), e3 = null;
    }
    if (j2) {
      if (a4 = "template" == j2 && t3.content || t3, e3 = "textarea" == j2 && null != C3.defaultValue ? null : e3 && d.call(a4.childNodes), !l3 && e3) for (x2 = {}, s3 = 0; s3 < t3.attributes.length; s3++) x2[(k2 = t3.attributes[s3]).name] = k2.value;
      for (s3 in x2) k2 = x2[s3], "dangerouslySetInnerHTML" == s3 ? v3 = k2 : "children" == s3 || s3 in C3 || "value" == s3 && "defaultValue" in C3 || "checked" == s3 && "defaultChecked" in C3 || T(t3, s3, null, k2, f4);
      for (s3 in M2 = 1 & i3.__u, C3) k2 = C3[s3], "children" == s3 ? _3 = k2 : "dangerouslySetInnerHTML" == s3 ? h3 = k2 : "value" == s3 ? b = k2 : "checked" == s3 ? m3 = k2 : l3 && "function" != typeof k2 || !(x2[s3] !== k2 || M2 && null != k2) || T(t3, s3, k2, x2[s3], f4);
      h3 ? (l3 || v3 && (h3.__html == v3.__html || h3.__html == t3.innerHTML) || (t3.innerHTML = h3.__html), r3.__k = []) : (v3 && (t3.textContent = ""), ("foreignObject" == j2 || "http://www.w3.org/1998/Math/MathML" == f4 && y.test(j2)) && (f4 = "http://www.w3.org/1999/xhtml"), H(a4, w(_3) ? _3 : [_3], r3, i3, u3, f4, e3, o4, e3 ? e3[0] : i3.__k && S(i3, 0), l3, c3), e3 && e3.some(g)), l3 && "textarea" != j2 || (s3 = "value", "progress" == j2 && null == b ? t3.removeAttribute(s3) : null == b || b === t3[s3] && ("progress" != j2 || b) || T(t3, s3, b, x2[s3], f4), s3 = "checked", null != m3 && m3 != t3[s3] && T(t3, s3, m3, x2[s3], f4));
    } else x2 === C3 || l3 && t3.data == C3 || (t3.data = C3);
    return t3;
  }
  function F(t3, r3, i3, u3) {
    try {
      "function" == typeof t3 ? r3 ? r3.__x = t3(r3) || 1 : u3 && (u3 = u3.__c || u3.__e) && (r3 = u3.__x) && (u3.__x = null, "function" == typeof r3 ? r3() : t3(null)) : t3.current = r3;
    } catch (t4) {
      n.__e(t4, i3);
    }
  }
  function G(t3, r3, i3) {
    var u3, f4, e3, o4;
    if (n.unmount && n.unmount(t3), !(u3 = t3.ref) || u3.current && u3.current != t3.__e || F(u3, null, r3, t3), u3 = t3.__c) {
      if (u3.componentWillUnmount) try {
        u3.componentWillUnmount();
      } catch (t4) {
        n.__e(t4, r3);
      }
      u3.__P = u3.__n = null;
    }
    if (u3 = t3.__k) for (o4 = 0; o4 < u3.length; o4++) u3[o4] && G(u3[o4], r3, "function" != typeof t3.type || i3 && !t3.props.__P);
    !i3 && (u3 = t3.__c) && (u3 = u3.__z) && (f4 = z(u3, e3 = [])) && (u3 == t3.__e && e3.some(g), g(f4), g(u3)), (u3 = t3.__e) && (i3 || g(u3), u3.__e && (u3.__e = null)), t3.__e = t3.__c = t3.__ = null;
  }
  function J(n2, t3, r3) {
    return this.constructor(n2, r3);
  }
  function K(t3, r3) {
    var i3, u3, f4, e3;
    n.__ && n.__(t3, r3), 9 == r3.nodeType && (r3 = r3.documentElement), u3 = (i3 = t3 && 32 & t3.__u) ? null : r3.__k, r3.__k = m(M, { children: [t3] }), f4 = [], e3 = [], V(r3, r3.__k, u3 || p, p, r3.namespaceURI, u3 ? null : r3.firstChild ? d.call(r3.childNodes) : null, f4, u3 ? u3.__e : r3.firstChild, i3, e3), D(f4, r3.__k, e3), r3.__k.props.children = null;
  }
  n = { __e: function(n2, t3, r3, i3) {
    for (var u3, e3, o4; t3 = t3.__; ) if ((u3 = t3.__c) && !(1 & u3.__g)) {
      u3.__g |= 4;
      try {
        if ((o4 = (e3 = u3.constructor) && e3.getDerivedStateFromError) && u3.setState(e3.getDerivedStateFromError(n2)), u3.componentDidCatch && (u3.componentDidCatch(n2, i3 || {}), o4 = 1), o4 && 8 & u3.__g) return void (u3.__g |= 2);
      } catch (t4) {
        n2 = t4;
      }
    }
    throw f = 0, n2;
  } }, t = 0, r = function(n2) {
    return null != n2 && n2.constructor === h;
  }, x.prototype.setState = function(n2, t3) {
    var r3 = this.__s;
    r3 && r3 != this.state || (r3 = this.__s = _({}, this.state)), "function" == typeof n2 && (n2 = n2(_({}, r3), this.props)), n2 && (_(r3, n2), this.__v && (t3 && this.__k.push(t3), j(this)));
  }, x.prototype.forceUpdate = function(n2) {
    this.__v && (this.__g |= 4, n2 && this.__h.push(n2), j(this));
  }, x.prototype.render = M, i = [], f = 0, e = function(n2, t3) {
    return n2.__v.__b - t3.__v.__b;
  }, o = /* @__PURE__ */ Symbol(), l = /(PointerCapture)$|Capture$/i, c = 0, a = {}, s = 0;

  // node_modules/preact/hooks/dist/hooks.mjs
  var t2;
  var r2;
  var u2;
  var i2;
  var o2 = Object.is;
  var f2 = 0;
  var c2 = [];
  var e2 = [];
  var a2 = n;
  var v2 = a2.__b;
  var l2 = a2.__r;
  var m2 = a2.diffed;
  var h2 = a2.__c;
  var s2 = a2.unmount;
  var p2 = a2.__;
  function y2(n2, t3) {
    a2.__h && a2.__h(r2, n2, f2 || t3), f2 = 0;
    var u3 = r2.__H || (r2.__H = { __: [], __h: [] });
    return n2 >= u3.__.length && u3.__.push({}), u3.__[n2];
  }
  function d2(n2) {
    return f2 = 1, _2(G2, n2);
  }
  function _2(n2, u3, i3) {
    var f4 = y2(t2++, 2);
    if (f4.t = n2, !f4.__c && (f4.__ = [i3 ? i3(u3) : G2(void 0, u3), function(n3) {
      var t3 = f4.__N ? f4.__N[0] : f4.__[0], r3 = f4.t(t3, n3);
      o2(t3, r3) || (f4.__N = [r3, f4.__[1]], f4.__c.setState({}));
    }], f4.__c = r2, !r2.__f)) {
      r2.__f = true;
      var c3 = r2.shouldComponentUpdate;
      r2.shouldComponentUpdate = function(n3, t3, r3) {
        var u4 = this.__H;
        if (!u4) return true;
        var i4 = false, f5 = this.props != n3;
        if (u4.__.some(function(n4) {
          n4.__N && (i4 = true, o2(n4.__[0], n4.__N[0]) || (f5 = true));
        }), c3) {
          var e3 = c3.call(this, n3, t3, r3);
          return i4 ? e3 || f5 : e3;
        }
        return !i4 || f5;
      };
    }
    return f4.__;
  }
  function A(n2, u3) {
    var i3 = y2(t2++, 3);
    !a2.__s && E2(i3.__H, u3) && (i3.__P = true, i3.__ = n2, i3.u = u3, r2.__H.__h.push(i3));
  }
  function T2(n2) {
    return f2 = 5, w2(function() {
      return { current: n2 };
    }, []);
  }
  function w2(n2, r3) {
    var u3 = y2(t2++, 7);
    return E2(u3.__H, r3) && (u3.__ = n2(), u3.__H = r3), u3.__;
  }
  function g2() {
    var n2;
    do {
      for (; n2 = e2.shift(); ) try {
        C2(n2);
      } catch (t4) {
        a2.__e(t4, { __: (n2 = n2.__P) && n2.__v });
      }
      for (; n2 = c2.shift(); ) {
        var t3 = n2.__H;
        if (n2.__P && t3) try {
          t3.__h.some(C2), t3.__h.some(D2), t3.__h = [];
        } catch (r3) {
          t3.__h = [], a2.__e(r3, n2.__v);
        }
      }
    } while (e2.length);
  }
  a2.__b = function(n2) {
    r2 = null, v2 && v2(n2);
  }, a2.__ = function(n2, t3) {
    n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), p2 && p2(n2, t3);
  }, a2.__r = function(n2) {
    l2 && l2(n2), t2 = 0;
    var i3 = (r2 = n2.__c).__H;
    i3 && (u2 == r2 ? r2.__h = [] : (i3.__h.some(C2), i3.__h.some(D2), t2 = 0), i3.__h = [], i3.__.some(function(n3) {
      n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
    })), u2 = r2;
  }, a2.diffed = function(n2) {
    m2 && m2(n2);
    var t3 = n2.__c;
    t3 && t3.__H && (t3.__H.__h.length && B2(c2.push(t3)), t3.__H.__.some(function(n3) {
      n3.u && (n3.__H = n3.u);
    })), u2 = r2 = null;
  }, a2.__c = function(n2, t3) {
    t3.some(function(n3) {
      try {
        n3.__h.some(C2), n3.__h = n3.__h.filter(function(n4) {
          return !n4.__ || D2(n4);
        });
      } catch (t4) {
        n3.__h = [function() {
          throw t4;
        }];
      }
    }), h2 && h2(n2, t3);
  }, a2.unmount = function(n2) {
    s2 && s2(n2);
    var t3, r3, u3 = n2.__c;
    u3 && u3.__H && (u3.__H.__.some(function(u4) {
      try {
        if (u4.__P && u4.__c) {
          if (void 0 === r3) {
            for (r3 = n2.__; r3 && (!r3.__c || !r3.__c.__P); ) r3 = r3.__;
            r3 = r3 && r3.__c;
          }
          u4.__P = r3, B2(e2.push(u4));
        } else C2(u4);
      } catch (n3) {
        t3 = n3;
      }
    }), u3.__H = void 0, t3 && a2.__e(t3, u3.__v));
  };
  var k = "function" == typeof requestAnimationFrame;
  function z2(n2) {
    var t3, r3 = function() {
      clearTimeout(u3), k && cancelAnimationFrame(t3), setTimeout(n2);
    }, u3 = setTimeout(r3, 35);
    k && (t3 = requestAnimationFrame(r3));
  }
  function B2(n2) {
    1 != n2 && i2 == a2.requestAnimationFrame || ((i2 = a2.requestAnimationFrame) || z2)(g2);
  }
  function C2(n2) {
    var t3 = r2, u3 = n2.__c;
    "function" == typeof u3 && (n2.__c = void 0, u3()), r2 = t3;
  }
  function D2(n2) {
    var t3 = r2;
    n2.__c = n2.__(), r2 = t3;
  }
  function E2(n2, t3) {
    return !n2 || n2.length != t3.length || t3.some(function(t4, r3) {
      return !o2(t4, n2[r3]);
    });
  }
  function G2(n2, t3) {
    return "function" == typeof t3 ? t3(n2) : t3;
  }

  // node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
  var f3 = /* @__PURE__ */ Symbol.for("pv");
  var o3 = 0;
  function a3(t3, e3, n2, u3, a4, i3) {
    e3 || (e3 = {});
    var c3, l3, p3 = e3;
    if ("ref" in p3 && "function" != typeof t3) for (l3 in p3 = {}, e3) "ref" == l3 ? c3 = e3[l3] : p3[l3] = e3[l3];
    var s3 = { type: t3, props: p3, key: n2, ref: c3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: f3, __v: --o3, __i: -1, __u: 0 };
    return (a4 || i3) && (s3.__source = a4, s3.__self = i3), n.vnode && n.vnode(s3), s3;
  }

  // web/src/panels.tsx
  var MW = globalThis.MW;
  var BTN = "flex h-[20px] min-w-0 items-center justify-center border border-ink bg-paper px-1 text-[10px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper";
  var LAB = "flex h-[20px] shrink-0 items-center px-1 text-[10px] uppercase leading-none whitespace-nowrap";
  var FIELD = "h-[20px] min-w-0 border border-ink bg-paper px-1 text-[11px] leading-none text-ink outline-none";
  var ROW = "flex items-stretch gap-px";
  function B3(props) {
    const { act, on, cls, children, title, name, onClick, disabled } = props;
    return /* @__PURE__ */ a3(
      "button",
      {
        type: "button",
        title,
        "data-act": act,
        "data-name": name,
        disabled,
        class: `${BTN} ${on ? "on" : ""} ${disabled ? "opacity-40" : ""} ${cls || ""}`,
        onClick,
        children
      }
    );
  }
  function L2(props) {
    return /* @__PURE__ */ a3("span", { class: `${LAB} ${props.cls || ""}`, children: props.children });
  }
  function R(props) {
    return /* @__PURE__ */ a3("div", { class: `${ROW} ${props.cls || ""}`, children: props.children });
  }
  function T3(props) {
    return /* @__PURE__ */ a3(
      "input",
      {
        class: `${FIELD} ${props.cls || ""}`,
        value: props.value ?? "",
        placeholder: props.placeholder,
        maxlength: props.maxlength,
        onInput: (e3) => props.onInput && props.onInput(e3.currentTarget.value)
      }
    );
  }
  function N2(props) {
    return /* @__PURE__ */ a3(
      "input",
      {
        id: props.id,
        type: "number",
        class: `${FIELD} ${props.cls || ""}`,
        value: props.value ?? 0,
        min: props.min,
        max: props.max,
        onChange: (e3) => props.onChange && props.onChange(parseInt(e3.currentTarget.value, 10) || 0)
      }
    );
  }
  function useKeys(keys) {
    const [, force] = _2((n2) => n2 + 1, 0);
    const key = keys.join("|");
    A(() => {
      if (!MW.store) return;
      return MW.store.subscribe(keys, force);
    }, [key]);
  }
  function TempoSlider(props) {
    const ref = T2(null);
    const dragging = T2(false);
    const pct = MW.clamp((props.value - 1) / (props.max - 1), 0, 1) * 100;
    const setFrom = (e3) => {
      const el = ref.current;
      if (!el) return;
      const r3 = el.getBoundingClientRect();
      const f4 = MW.clamp((e3.clientX - r3.left) / Math.max(1, r3.width), 0, 1);
      props.onChange(1 + f4 * (props.max - 1));
    };
    return /* @__PURE__ */ a3(
      "div",
      {
        ref,
        class: `tslider ${props.cls || ""}`,
        onPointerDown: (e3) => {
          dragging.current = true;
          try {
            e3.currentTarget.setPointerCapture(e3.pointerId);
          } catch (err) {
          }
          setFrom(e3);
        },
        onPointerMove: (e3) => {
          if (dragging.current) setFrom(e3);
        },
        onPointerUp: () => {
          dragging.current = false;
        },
        onPointerCancel: () => {
          dragging.current = false;
        },
        children: /* @__PURE__ */ a3("div", { class: "knob", style: { left: `calc(${pct.toFixed(2)}% - 5px)` } })
      }
    );
  }
  function PB(props) {
    const cls = "flex h-full items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper";
    return /* @__PURE__ */ a3(
      "button",
      {
        type: "button",
        "data-act": props.act,
        "data-name": props.name,
        class: `${cls} ${props.on ? "on" : ""} ${props.cls || ""}`,
        title: props.title,
        onClick: props.onClick,
        children: props.children
      }
    );
  }
  function PlayPanel() {
    useKeys(["transport"]);
    const app = MW.app;
    const song = app.song;
    const [, force] = _2((n2) => n2 + 1, 0);
    const eq = app.eq || [true, true, true];
    const tempo = song.deftempo || 33;
    const tempo2 = song.tempo2 || 6;
    const setTempo = (kind, value) => {
      const max = kind === "tempo" ? 240 : 32;
      const v3 = MW.clamp(Math.round(value), 1, max);
      if (kind === "tempo") {
        song.deftempo = v3;
        if (!MW.player.playing) MW.player.tempo = v3;
      } else {
        song.tempo2 = v3;
        if (!MW.player.playing) MW.player.tempo2 = v3;
      }
      force(0);
    };
    const stepTempo = (kind, d3) => setTempo(kind, (kind === "tempo" ? song.deftempo : song.tempo2) + d3);
    return /* @__PURE__ */ a3("div", { class: "playpanel", children: [
      /* @__PURE__ */ a3("div", { class: "flex h-[46px] shrink-0 items-stretch", children: [
        /* @__PURE__ */ a3(TempoSlider, { kind: "tempo", value: tempo, max: 240, cls: "flex-[1.68]", onChange: (v3) => setTempo("tempo", v3) }),
        /* @__PURE__ */ a3(PB, { cls: "w-[24px] shrink-0 text-[16px]", onClick: () => stepTempo("tempo", -1), title: "Slower", children: "\u2039" }),
        /* @__PURE__ */ a3(PB, { cls: "w-[24px] shrink-0 text-[16px]", onClick: () => stepTempo("tempo", 1), title: "Faster", children: "\u203A" }),
        /* @__PURE__ */ a3(TempoSlider, { kind: "tempo2", value: tempo2, max: 32, cls: "flex-1", onChange: (v3) => setTempo("tempo2", v3) }),
        /* @__PURE__ */ a3(PB, { cls: "w-[24px] shrink-0 text-[16px]", onClick: () => stepTempo("tempo2", -1), title: "Fewer pulses per line", children: "\u2039" }),
        /* @__PURE__ */ a3(PB, { cls: "w-[24px] shrink-0 text-[16px]", onClick: () => stepTempo("tempo2", 1), title: "More pulses per line", children: "\u203A" })
      ] }),
      /* @__PURE__ */ a3("div", { class: "flex h-[33px] shrink-0 items-stretch", children: [
        /* @__PURE__ */ a3("span", { class: "flex w-[45px] shrink-0 items-center pl-1 text-[16px] leading-none", children: "VOL:" }),
        /* @__PURE__ */ a3(PB, { act: "vol-hex", on: !!song.flags.volhex, cls: "w-[43px]", children: "HEX" }),
        /* @__PURE__ */ a3(PB, { act: "vol-dec", on: !song.flags.volhex, cls: "w-[46px]", children: "DEC" }),
        /* @__PURE__ */ a3(PB, { act: "misc-filter", on: !!song.flags.filteron, cls: "w-[78px]", children: "FILTER" }),
        /* @__PURE__ */ a3(PB, { act: "eq-1", on: !!eq[0], cls: "min-w-0 flex-1", children: "E1" }),
        /* @__PURE__ */ a3(PB, { act: "eq-2", on: !!eq[1], cls: "min-w-0 flex-1", children: "E2" }),
        /* @__PURE__ */ a3(PB, { act: "eq-3", on: !!eq[2], cls: "min-w-0 flex-1", children: "E3" }),
        /* @__PURE__ */ a3(PB, { act: "stslide", on: !!song.flags.stslide, cls: "w-[55px]", children: "STS" }),
        /* @__PURE__ */ a3("span", { class: "flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink w-[58px]", children: "SPD" }),
        /* @__PURE__ */ a3("span", { class: "flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink w-[100px]", children: /* @__PURE__ */ a3("b", { id: "spd-readout", class: "font-normal tabular-nums", children: [
          String(tempo).padStart(3, "0"),
          "/",
          String(tempo2).padStart(2, "0")
        ] }) })
      ] }),
      /* @__PURE__ */ a3("div", { class: "grid h-[55px] shrink-0 grid-cols-[130px_72px_minmax(0,1fr)]", children: [
        /* @__PURE__ */ a3("div", { class: "grid grid-rows-2", children: [
          /* @__PURE__ */ a3("div", { class: "flex items-stretch", children: [
            /* @__PURE__ */ a3("span", { class: "flex min-w-0 flex-1 items-center justify-end pr-2 text-[16px] leading-none", children: "CH.MODE:" }),
            /* @__PURE__ */ a3(PB, { act: app.depth === "enhanced" ? "depth-classic" : "depth-enhanced", on: app.depth === "enhanced", cls: "w-[34px]", title: "High quality output", children: "HQ" })
          ] }),
          /* @__PURE__ */ a3("div", { class: "flex items-stretch", children: [4, 5, 6, 7, 8].map((n2) => /* @__PURE__ */ a3(PB, { act: `chmode-${n2}`, on: song.channels === n2, cls: "min-w-0 flex-1", children: n2 }, n2)) })
        ] }),
        /* @__PURE__ */ a3("button", { class: "flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper border-l-0", id: "btn-stop", title: "Stop (Space)", onClick: () => MW.player.stop(), children: "STOP" }),
        /* @__PURE__ */ a3("div", { class: "grid grid-rows-2 border-l border-ink", children: [
          /* @__PURE__ */ a3("div", { class: "flex items-stretch", children: [
            /* @__PURE__ */ a3("button", { class: `flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-[1.6] ${MW.player.playing ? "playing" : ""}`, id: "btn-play", title: "Play song", onClick: () => MW.player.play(true), children: "PLAY SONG" }),
            /* @__PURE__ */ a3("button", { class: "flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1", id: "btn-cont", title: "Continue from here", onClick: () => MW.player.play(false), children: "CONT. SONG" })
          ] }),
          /* @__PURE__ */ a3("div", { class: "flex items-stretch", children: [
            /* @__PURE__ */ a3("button", { class: "flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-[1.6]", id: "btn-play-block", title: "Play the current block", onClick: () => MW.player.playBlock(app.cursor.block), children: "PLAY BLOCK" }),
            /* @__PURE__ */ a3(PB, { act: "play-on-note", on: !!app.playOnNote, cls: "w-[38px]", title: "Play a note as you enter it", children: "D" }),
            /* @__PURE__ */ a3("button", { class: "flex items-center justify-center border border-ink bg-paper px-1.5 text-[15px] leading-none whitespace-nowrap text-ink on:bg-ink on:text-paper active:bg-ink active:text-paper playing:bg-ink playing:text-paper min-w-0 flex-1", id: "btn-cont-block", title: "Continue the block from the cursor", onClick: () => MW.player.playBlock(app.cursor.block), children: "CONT. BLOCK" })
          ] })
        ] })
      ] })
    ] });
  }
  function FilesPanel() {
    useKeys(["song"]);
    const app = MW.app;
    const fmt = app.saveFormat || "mmd1";
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[82px] justify-end", children: "SAVE FORMAT:" }),
        /* @__PURE__ */ a3(B3, { act: "file-info", on: !!app.saveInfo, cls: "w-[46px]", children: "INFO" }),
        /* @__PURE__ */ a3(B3, { act: "file-open", cls: "flex-1", children: "LOAD SONG" }),
        /* @__PURE__ */ a3(B3, { act: "ins-open", cls: "flex-1", children: "LOAD INSTR" }),
        /* @__PURE__ */ a3(B3, { act: "file-del", cls: "w-[58px]", children: "DEL FILE" }),
        /* @__PURE__ */ a3(B3, { act: "file-load-msg", cls: "w-[62px]", children: "LOAD MSG" }),
        /* @__PURE__ */ a3(B3, { act: "file-load-map", cls: "w-[42px]", children: "MAP" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[82px]" }),
        /* @__PURE__ */ a3(B3, { act: "missing", name: "Amiga icon files", disabled: true, cls: "w-[46px]", children: "ICON" }),
        /* @__PURE__ */ a3(B3, { act: "file-save-song", cls: "flex-1", children: "SAVE SONG" }),
        /* @__PURE__ */ a3(B3, { act: "file-save-iff", cls: "flex-1", children: "SAVE INSTR" }),
        /* @__PURE__ */ a3(B3, { act: "file-save-msg", cls: "w-[62px]", children: "SAVE MSG" }),
        /* @__PURE__ */ a3(B3, { act: "file-save-map", cls: "w-[42px]", children: "MAP" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "fmt-mmd1", on: fmt === "mmd1", cls: "w-[82px]", children: "MOD1(+INSTR)" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[32px]", children: "DIR:" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px] opacity-60", children: "browser" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "fmt-mmd1n", on: fmt === "mmd1n", cls: "w-[82px]", children: "MOD1(NO INSTR)" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[32px]", children: "FILE:" }),
        /* @__PURE__ */ a3(T3, { value: app.song.name || "", maxlength: 40, onInput: (v3) => {
          app.song.name = v3;
        }, cls: "flex-1" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "fmt-mmd0", on: fmt === "mmd0", cls: "w-[82px]", children: "MOD0 (OLD)" }),
        /* @__PURE__ */ a3(B3, { act: "fmt-st", on: fmt === "st", cls: "w-[82px]", children: "ST-MODULE" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[42px]", children: "EXPORT" }),
        /* @__PURE__ */ a3(B3, { act: "audio-wav", cls: "w-[42px]", children: "WAV" }),
        /* @__PURE__ */ a3(B3, { act: "audio-aac", cls: "w-[42px]", children: "AAC" }),
        /* @__PURE__ */ a3(B3, { act: "audio-mp3", cls: "w-[42px]", children: "MP3" }),
        /* @__PURE__ */ a3(B3, { act: "file-demo", cls: "flex-1", children: "DEMO" })
      ] })
    ] });
  }
  function InstrPanel() {
    useKeys(["currentIns"]);
    const app = MW.app;
    const inst = app.song.instruments[app.currentIns - 1];
    const vol = inst ? inst.volume ?? 64 : 64;
    const setInst = (fn) => {
      const i3 = app.song.instruments[app.currentIns - 1];
      if (!i3) return;
      fn(i3);
      MW.panels.refresh();
    };
    const setType = (type) => setInst((i3) => {
      if ((type === "synth" || type === "hybrid") && !i3.synth) {
        i3.synth = MW.createSynth();
        const data = i3.data || new Float32Array(0);
        const wave = new Float32Array(64);
        for (let k2 = 0; k2 < wave.length; k2++) wave[k2] = data[k2] || 0;
        i3.synth.waveforms = [wave];
        i3.synth.voltbl = [64, 255];
        i3.synth.wftbl = [0, 255];
      }
      if (type === "sample" && i3.synth) {
        const rendered = MW.renderSynth(i3, 44100, 50, 2);
        if (rendered) {
          i3.data = Float32Array.from(rendered);
          i3.dataR = null;
          i3.bits16 = false;
          i3.stereo16 = false;
        }
      }
      i3.type = type;
    });
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[24px] items-center justify-center border border-ink bg-paper text-[10px]", children: MW.insName(app.currentIns) }),
        /* @__PURE__ */ a3(T3, { value: inst ? inst.name || "" : "", maxlength: 39, onInput: (v3) => setInst((i3) => {
          i3.name = v3;
        }), cls: "flex-1" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[36px]", children: "LEN:" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[64px] items-center justify-end border border-ink bg-paper px-1 text-[11px] tabular-nums", children: inst && inst.data ? inst.data.length : 0 })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "ins-first", cls: "w-[24px]", children: "|<" }),
        /* @__PURE__ */ a3(B3, { act: "ins-prev", cls: "w-[24px]", children: "<" }),
        /* @__PURE__ */ a3(B3, { act: "ins-next", cls: "w-[24px]", children: ">" }),
        /* @__PURE__ */ a3(B3, { act: "ins-last", cls: "w-[24px]", children: ">|" }),
        /* @__PURE__ */ a3(B3, { act: "ins-lastoccupied", cls: "w-[30px]", children: ">|<" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[52px]", children: "TRANSPOSE" }),
        /* @__PURE__ */ a3(B3, { onClick: () => setInst((i3) => {
          i3.transpose = Math.max(-48, (i3.transpose || 0) - 1);
        }), cls: "w-[16px]", children: "-" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]", children: inst ? inst.transpose || 0 : 0 }),
        /* @__PURE__ */ a3(B3, { onClick: () => setInst((i3) => {
          i3.transpose = Math.min(48, (i3.transpose || 0) + 1);
        }), cls: "w-[16px]", children: "+" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[46px]", children: "FINETUNE" }),
        /* @__PURE__ */ a3(B3, { onClick: () => setInst((i3) => {
          i3.finetune = Math.max(-8, (i3.finetune || 0) - 1);
        }), cls: "w-[16px]", children: "-" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[26px] items-center justify-center border border-ink bg-paper text-[11px]", children: inst ? inst.finetune || 0 : 0 }),
        /* @__PURE__ */ a3(B3, { onClick: () => setInst((i3) => {
          i3.finetune = Math.min(7, (i3.finetune || 0) + 1);
        }), cls: "w-[16px]", children: "+" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[32px]", children: "HLD:" }),
        /* @__PURE__ */ a3(N2, { value: inst ? inst.hold || 0 : 0, min: 0, max: 255, onChange: (v3) => setInst((i3) => {
          i3.hold = v3;
        }), cls: "w-[34px]" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[32px]", children: "R/B:" }),
        /* @__PURE__ */ a3(N2, { value: inst ? inst.loop || 0 : 0, min: 0, onChange: (v3) => setInst((i3) => {
          i3.loop = v3;
        }), cls: "w-[52px]" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "ins-kill", cls: "w-[54px]", children: "FLUSH" }),
        /* @__PURE__ */ a3(B3, { act: "ins-open", cls: "w-[46px]", children: "LOAD" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[32px]", children: "DEC:" }),
        /* @__PURE__ */ a3(N2, { value: inst ? inst.decay || 0 : 0, min: 0, max: 255, onChange: (v3) => setInst((i3) => {
          i3.decay = v3;
        }), cls: "w-[34px]" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[32px]", children: "R/L:" }),
        /* @__PURE__ */ a3(N2, { value: inst ? inst.looplen || 0 : 0, min: 0, onChange: (v3) => setInst((i3) => {
          i3.looplen = v3;
        }), cls: "w-[52px]" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[42px]", children: "TYPE:" }),
        /* @__PURE__ */ a3(B3, { onClick: () => setType("sample"), on: inst && inst.type === "sample", cls: "w-[58px]", children: "SAMPLE" }),
        /* @__PURE__ */ a3(B3, { onClick: () => setType("synth"), on: inst && inst.type === "synth", cls: "w-[52px]", children: "SYNTH" }),
        /* @__PURE__ */ a3(B3, { onClick: () => setType("hybrid"), on: inst && inst.type === "hybrid", cls: "w-[54px]", children: "HYBRID" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[34px]", children: "VOL:" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[50px] items-center justify-center border border-ink bg-paper text-[11px] tabular-nums", children: [
          vol,
          "/",
          vol.toString(16).toUpperCase().padStart(2, "0")
        ] }),
        /* @__PURE__ */ a3(B3, { onClick: () => setInst((i3) => {
          i3.volume = Math.max(0, (i3.volume ?? 64) - 1);
        }), cls: "w-[18px]", children: "<" }),
        /* @__PURE__ */ a3(
          "input",
          {
            type: "range",
            min: "0",
            max: "64",
            value: vol,
            class: "h-[20px] min-w-0 flex-1",
            onChange: (e3) => setInst((i3) => {
              i3.volume = +e3.currentTarget.value;
            })
          }
        ),
        /* @__PURE__ */ a3(B3, { onClick: () => setInst((i3) => {
          i3.volume = Math.min(64, (i3.volume ?? 64) + 1);
        }), cls: "w-[18px]", children: ">" })
      ] })
    ] });
  }
  function BlockPanel() {
    const app = MW.app;
    const b = app.song.blocks[app.cursor.block];
    const [factor, setFactor] = d2(2);
    const lines = (n2) => MW.ops.setLines(MW.clamp(n2, 1, 3200));
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[30px]", children: "TRK:" }),
        /* @__PURE__ */ a3(B3, { act: "trk-cut", cls: "w-[42px]", children: "CUT" }),
        /* @__PURE__ */ a3(B3, { act: "trk-copy", cls: "w-[46px]", children: "COPY" }),
        /* @__PURE__ */ a3(B3, { act: "trk-paste", cls: "w-[46px]", children: "PASTE" }),
        /* @__PURE__ */ a3(B3, { act: "trk-swap", cls: "w-[46px]", children: "SWAP" }),
        /* @__PURE__ */ a3(B3, { act: "track-ins", cls: "w-[58px]", children: "INS.TRK" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[36px]", children: "TRKS:" }),
        [4, 8, 12, 16].map((n2) => /* @__PURE__ */ a3(B3, { act: `blk-tracks-${n2}`, on: b.tracks === n2, cls: "w-[28px]", children: n2 }, n2))
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[30px]", children: "BLK:" }),
        /* @__PURE__ */ a3(B3, { act: "blk-cut", cls: "w-[42px]", children: "CUT" }),
        /* @__PURE__ */ a3(B3, { act: "blk-copy", cls: "w-[46px]", children: "COPY" }),
        /* @__PURE__ */ a3(B3, { act: "blk-paste", cls: "w-[46px]", children: "PASTE" }),
        /* @__PURE__ */ a3(B3, { act: "blk-swap", cls: "w-[46px]", children: "SWAP" }),
        /* @__PURE__ */ a3(B3, { act: "track-del", cls: "w-[58px]", children: "DEL.TRK" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[38px]", children: "LINES:" }),
        /* @__PURE__ */ a3(N2, { value: b.lines, min: 1, max: 3200, onChange: lines, cls: "w-[46px]" }),
        /* @__PURE__ */ a3(B3, { onClick: () => lines(b.lines - 1), cls: "w-[18px]", children: "<" }),
        /* @__PURE__ */ a3(B3, { onClick: () => lines(b.lines + 1), cls: "w-[18px]", children: ">" }),
        /* @__PURE__ */ a3(B3, { onClick: () => lines(b.lines - 10), cls: "w-[20px]", children: "<<" }),
        /* @__PURE__ */ a3(B3, { onClick: () => lines(b.lines + 10), cls: "w-[20px]", children: ">>" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "blk-expand", cls: "w-[54px]", children: "EXPAND" }),
        /* @__PURE__ */ a3(
          "input",
          {
            type: "number",
            min: "2",
            max: "9",
            value: factor,
            class: `${FIELD} w-[28px]`,
            onChange: (e3) => setFactor(parseInt(e3.currentTarget.value, 10) || 2)
          }
        ),
        /* @__PURE__ */ a3(B3, { act: "blk-shrink", cls: "w-[54px]", children: "SHRINK" }),
        /* @__PURE__ */ a3(B3, { act: "line-ins", cls: "w-[44px]", children: "INS.L." }),
        /* @__PURE__ */ a3(B3, { act: "line-del", cls: "w-[44px]", children: "DEL.L." }),
        /* @__PURE__ */ a3(B3, { act: "del-buffer", cls: "w-[58px]", children: "DEL BUFF" }),
        [1, 2, 3, 4, 8, 16].map((n2) => /* @__PURE__ */ a3(B3, { act: `hl-${n2}`, cls: "w-[20px]", children: n2 }, n2)),
        /* @__PURE__ */ a3(B3, { act: "hl-clear", cls: "w-[20px]", children: "C" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "blk-new", cls: "w-[64px]", children: "NEW BLOCK" }),
        /* @__PURE__ */ a3(B3, { act: "blk-new-def", cls: "w-[34px]", children: "DEF" }),
        /* @__PURE__ */ a3(B3, { act: "blk-new-here", cls: "w-[64px]", children: "NEW HERE" }),
        /* @__PURE__ */ a3(B3, { act: "blk-new-here-def", cls: "w-[34px]", children: "DEF" }),
        /* @__PURE__ */ a3(B3, { act: "blk-del-last", cls: "w-[70px]", children: "DELETE LAST" }),
        /* @__PURE__ */ a3(B3, { act: "blk-del", cls: "w-[70px]", children: "DELETE THIS" }),
        /* @__PURE__ */ a3(B3, { act: "blk-split", cls: "w-[42px]", children: "SPLIT" }),
        /* @__PURE__ */ a3(B3, { act: "blk-join", cls: "w-[42px]", children: "JOIN" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[42px]", children: "NAME:" }),
        /* @__PURE__ */ a3(T3, { value: b.name || "", maxlength: 40, onInput: (v3) => {
          b.name = v3;
        }, cls: "flex-1" })
      ] })
    ] });
  }
  function EditPanel() {
    useKeys(["editMode", "spaceAsDel", "chordMode", "octave", "advance"]);
    const app = MW.app;
    const def = app.prog && app.prog[app.progTarget];
    const toggleTrack = (t3) => {
      app.mutedTracks[t3] = !app.mutedTracks[t3];
      MW.player.channels[t3].muted = app.mutedTracks[t3];
      MW.grid.render();
      MW.panels.refresh();
    };
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[54px]", children: "TRK ON:" }),
        Array.from({ length: 16 }, (_3, t3) => /* @__PURE__ */ a3(B3, { onClick: () => toggleTrack(t3), on: !app.mutedTracks[t3], cls: "flex-1 px-0", children: t3.toString(16).toUpperCase() }, t3)),
        /* @__PURE__ */ a3(B3, { onClick: () => {
          for (let t3 = 0; t3 < 16; t3++) {
            app.mutedTracks[t3] = false;
            MW.player.channels[t3].muted = false;
          }
          MW.grid.render();
        }, cls: "w-[34px]", children: "SET" }),
        /* @__PURE__ */ a3(B3, { onClick: () => {
          for (let t3 = 0; t3 < 16; t3++) {
            app.mutedTracks[t3] = true;
            MW.player.channels[t3].muted = true;
          }
          MW.grid.render();
        }, cls: "w-[34px]", children: "CLR" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[48px]", children: "KEYPAD:" }),
        /* @__PURE__ */ a3(B3, { act: "pad-mode", on: app.padMode === "track", cls: "w-[74px]", children: "TRK ON/OFF" }),
        /* @__PURE__ */ a3(B3, { act: "pad-mode", on: app.padMode === "instr", cls: "w-[70px]", children: "SEL.INSTR" }),
        /* @__PURE__ */ a3(B3, { act: "pad-map2", on: !!app.padMap2, cls: "w-[42px]", children: "MAP2" }),
        /* @__PURE__ */ a3(B3, { act: "alt-clear", cls: "w-[22px]", children: "C" }),
        /* @__PURE__ */ a3(B3, { act: "alt-pick-l", cls: "w-[22px]", children: "L" }),
        /* @__PURE__ */ a3(B3, { act: "alt-pick-r", cls: "w-[22px]", children: "R" }),
        /* @__PURE__ */ a3(B3, { act: "prog-prev", cls: "w-[16px]", children: "<" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[20px] items-center justify-center border border-ink bg-paper text-[11px]", children: app.progTarget }),
        /* @__PURE__ */ a3(B3, { act: "prog-next", cls: "w-[16px]", children: ">" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[12px] items-center justify-center text-[10px]", children: "=" }),
        /* @__PURE__ */ a3(
          "input",
          {
            value: MW.noteName(def ? def.note || 0 : 0, app.hb),
            class: `${FIELD} w-[36px] text-center`,
            onInput: (e3) => {
              if (!def) return;
              def.note = MW.noteIndex(e3.currentTarget.value);
            }
          }
        ),
        /* @__PURE__ */ a3(
          "input",
          {
            value: MW.insName(def ? def.ins || 0 : 0),
            class: `${FIELD} w-[30px] text-center`,
            onInput: (e3) => {
              if (!def) return;
              def.ins = parseInt(e3.currentTarget.value, 32) || 0;
            }
          }
        ),
        /* @__PURE__ */ a3(
          "input",
          {
            value: (def ? def.cmd || 0 : 0).toString(16).toUpperCase().padStart(2, "0"),
            class: `${FIELD} w-[28px] text-center`,
            onInput: (e3) => {
              if (!def) return;
              def.cmd = parseInt(e3.currentTarget.value, 16) || 0;
            }
          }
        ),
        /* @__PURE__ */ a3(
          "input",
          {
            value: (def ? def.dat || 0 : 0).toString(16).toUpperCase().padStart(2, "0"),
            class: `${FIELD} w-[28px] text-center`,
            onInput: (e3) => {
              if (!def) return;
              def.dat = parseInt(e3.currentTarget.value, 16) || 0;
            }
          }
        ),
        /* @__PURE__ */ a3(B3, { act: "edit-space", on: !!app.spaceAsDel, cls: "w-[72px]", children: "SPACE=DEL" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[48px]", children: "OCTAVE:" }),
        Array.from({ length: 9 }, (_3, i3) => /* @__PURE__ */ a3(B3, { act: `oct-${i3}`, on: app.octave === i3, cls: "w-[26px]", children: i3 + 1 }, i3)),
        /* @__PURE__ */ a3(B3, { act: "edit-toggle", on: !!app.editMode, cls: "w-[58px]", children: "EDIT ON" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[34px]", children: "ADV." }),
        [["up", "\u2191"], ["down", "\u2193"], ["nexttrk", "\xBB"], ["prevtrk", "\xAB"], ["right", ">"], ["left", "<"]].map(([k2, l3]) => /* @__PURE__ */ a3(B3, { act: `adv-${k2}`, on: app.advance === k2, cls: "w-[24px]", children: l3 }, k2)),
        /* @__PURE__ */ a3(L2, { cls: "w-[34px]", children: "PICK:" }),
        /* @__PURE__ */ a3(B3, { act: "pick-note", cls: "w-[42px]", children: "NOTE" }),
        /* @__PURE__ */ a3(B3, { act: "pick-range", cls: "w-[44px]", children: "RANGE" }),
        /* @__PURE__ */ a3(B3, { act: "pick-buffer", cls: "w-[34px]", children: "BUF" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[26px]", children: "SPC" }),
        /* @__PURE__ */ a3(N2, { value: app.step, min: 1, max: 16, onChange: (v3) => {
          app.step = v3;
        }, cls: "w-[34px]" })
      ] })
    ] });
  }
  function MiscPanel() {
    useKeys(["song"]);
    const app = MW.app;
    const rgb = app.paletteRGB || { r: 136, g: 136, b: 136 };
    const setRGB = (key, value) => {
      app.paletteRGB[key] = value;
      MW.runAction("pal-set");
    };
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[16px]", children: "R" }),
        /* @__PURE__ */ a3("input", { type: "range", min: "0", max: "255", value: rgb.r, class: "h-[20px] w-[120px]", onChange: (e3) => setRGB("r", +e3.currentTarget.value) }),
        /* @__PURE__ */ a3("span", { class: `${FIELD} w-[28px] text-center`, children: rgb.r }),
        [0, 1, 2, 3, 4, 5, 6, 7].map((n2) => /* @__PURE__ */ a3(B3, { onClick: () => MW.missing("RGB palette"), cls: `w-[18px] ${n2 === 0 ? "bg-ink" : ""}`, children: " " }, n2)),
        /* @__PURE__ */ a3(B3, { act: "pal-reset", cls: "w-[34px]", children: "RES" }),
        /* @__PURE__ */ a3(B3, { act: "pal-undo", cls: "w-[38px]", children: "UNDO" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[16px]", children: "G" }),
        /* @__PURE__ */ a3("input", { type: "range", min: "0", max: "255", value: rgb.g, class: "h-[20px] w-[120px]", onChange: (e3) => setRGB("g", +e3.currentTarget.value) }),
        /* @__PURE__ */ a3("span", { class: `${FIELD} w-[28px] text-center`, children: rgb.g }),
        /* @__PURE__ */ a3(B3, { act: "ptkey", on: !!app.ptkey, cls: "w-[46px]", children: "PTKEY" }),
        /* @__PURE__ */ a3(B3, { act: "missing", name: "Workbench", disabled: true, cls: "w-[44px]", children: "WB OPEN" }),
        /* @__PURE__ */ a3(B3, { act: "missing", name: "Workbench", disabled: true, cls: "w-[44px]", children: "CLOSE" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[16px]", children: "B" }),
        /* @__PURE__ */ a3("input", { type: "range", min: "0", max: "255", value: rgb.b, class: "h-[20px] w-[120px]", onChange: (e3) => setRGB("b", +e3.currentTarget.value) }),
        /* @__PURE__ */ a3("span", { class: `${FIELD} w-[28px] text-center`, children: rgb.b }),
        /* @__PURE__ */ a3(B3, { act: "name-flat", on: !!app.hb, cls: "w-[44px]", children: "H\u2194B" }),
        /* @__PURE__ */ a3(B3, { act: "missing", name: "Load graphics", disabled: true, cls: "w-[58px]", children: "LOADGFX" }),
        /* @__PURE__ */ a3(B3, { act: "missing", name: "Mouse pointer", disabled: true, cls: "w-[50px]", children: "MOUSE2" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "paths-info", cls: "w-[52px]", children: "PATHS" }),
        /* @__PURE__ */ a3(B3, { act: "paths-add", cls: "w-[34px]", children: "ADD" }),
        /* @__PURE__ */ a3(B3, { act: "paths-rem", cls: "w-[34px]", children: "REM" }),
        /* @__PURE__ */ a3(B3, { act: "misc-clear-all", cls: "w-[70px]", children: "CLEAR ALL" }),
        /* @__PURE__ */ a3(B3, { act: "misc-clear", cls: "w-[106px]", children: "CLEAR SONG ONLY" }),
        /* @__PURE__ */ a3(B3, { act: "quit-app", cls: "w-[38px]", children: "QUIT" }),
        /* @__PURE__ */ a3(B3, { act: "confirm-toggle", on: app.confirmOn !== false, cls: "w-[54px]", children: "CONFIRM" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "no16", on: !!app.no16, cls: "w-[42px]", children: "NO16" }),
        /* @__PURE__ */ a3(B3, { act: "dep2", on: !!app.dep2, cls: "w-[42px]", children: "DEP2" }),
        /* @__PURE__ */ a3(B3, { act: "prefs-save", cls: "w-[72px]", children: "SAVE PREFS" }),
        /* @__PURE__ */ a3(B3, { act: "prefs-reset", cls: "w-[72px]", children: "FORGET" }),
        /* @__PURE__ */ a3(B3, { act: "pal-cycle", cls: "w-[46px]", children: "COLOUR" })
      ] })
    ] });
  }
  function VolPanel() {
    useKeys(["song"]);
    const app = MW.app;
    const song = app.song;
    const trk = app.volTrack || 0;
    const setTrack = (t3) => {
      app.volTrack = t3;
      MW.panels.refresh();
    };
    const setVol = (t3, v3) => {
      song.trkvol[t3] = MW.clamp(v3, 0, 64);
      MW.panels.refresh();
    };
    const setMaster = (v3) => {
      song.mastervol = MW.clamp(v3, 0, 64);
      MW.panels.refresh();
    };
    const cells = [];
    for (let t3 = 0; t3 < 16; t3++) {
      cells.push(
        /* @__PURE__ */ a3(B3, { onClick: () => setTrack(t3), on: trk === t3, cls: "flex-1 px-0", children: [
          t3.toString(16).toUpperCase(),
          ":",
          String(song.trkvol[t3] || 64).padStart(2, "0")
        ] }, t3)
      );
    }
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: /* @__PURE__ */ a3("div", { class: "flex items-start gap-2", children: [
      /* @__PURE__ */ a3("div", { class: "flex flex-1 flex-col gap-px", children: [
        /* @__PURE__ */ a3(L2, { children: "THE RELATIVE VOLUMES OF TRACKS 0\u201315:" }),
        /* @__PURE__ */ a3(R, { children: cells.slice(0, 8) }),
        /* @__PURE__ */ a3(R, { children: cells.slice(8) }),
        /* @__PURE__ */ a3(R, { children: [
          /* @__PURE__ */ a3(L2, { cls: "w-[36px]", children: [
            trk.toString(16).toUpperCase(),
            ":"
          ] }),
          /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[34px] items-center justify-center border border-ink bg-paper text-[11px]", children: song.trkvol[trk] || 64 }),
          /* @__PURE__ */ a3(B3, { onClick: () => setVol(trk, (song.trkvol[trk] || 64) - 10), cls: "w-[24px]", children: "\xAB" }),
          /* @__PURE__ */ a3(B3, { onClick: () => setVol(trk, (song.trkvol[trk] || 64) - 1), cls: "w-[22px]", children: "\u2039" }),
          /* @__PURE__ */ a3(B3, { onClick: () => setVol(trk, (song.trkvol[trk] || 64) + 1), cls: "w-[22px]", children: "\u203A" }),
          /* @__PURE__ */ a3(B3, { onClick: () => setVol(trk, (song.trkvol[trk] || 64) + 10), cls: "w-[24px]", children: "\xBB" }),
          /* @__PURE__ */ a3(L2, { cls: "w-[44px]", children: "MASTER" }),
          /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[34px] items-center justify-center border border-ink bg-paper text-[11px]", children: song.mastervol }),
          /* @__PURE__ */ a3(B3, { onClick: () => setMaster(song.mastervol - 10), cls: "w-[24px]", children: "\xAB" }),
          /* @__PURE__ */ a3(B3, { onClick: () => setMaster(song.mastervol - 1), cls: "w-[22px]", children: "\u2039" }),
          /* @__PURE__ */ a3(B3, { onClick: () => setMaster(song.mastervol + 1), cls: "w-[22px]", children: "\u203A" }),
          /* @__PURE__ */ a3(B3, { onClick: () => setMaster(song.mastervol + 10), cls: "w-[24px]", children: "\xBB" })
        ] })
      ] }),
      /* @__PURE__ */ a3("div", { class: "w-[210px] shrink-0 border border-ink p-2 text-center text-[10px] leading-tight", children: [
        /* @__PURE__ */ a3("div", { children: "OCTANAUT" }),
        /* @__PURE__ */ a3("div", { children: "BROWSER TRACKER" }),
        /* @__PURE__ */ a3("div", { class: "my-1", children: "\u2014" }),
        /* @__PURE__ */ a3("div", { children: "EIGHT CHANNELS" }),
        /* @__PURE__ */ a3("div", { children: "MED MODULES" })
      ] })
    ] }) });
  }
  function RangePanel() {
    useKeys(["selection", "selectedTracks"]);
    const app = MW.app;
    const b = app.song.blocks[app.cursor.block];
    const sel = app.selection;
    const [echoDist, setEchoDist] = d2(2);
    const [echoMin, setEchoMin] = d2(1);
    const rangeText = sel ? `${Math.min(sel.t0, sel.t1)}\u2013${Math.max(sel.t0, sel.t1)} / ${Math.min(sel.l0, sel.l1)}\u2013${Math.max(sel.l0, sel.l1)}` : "---";
    const selectTrack = () => {
      app.selection = { l0: 0, l1: b.lines - 1, t0: app.cursor.track, t1: app.cursor.track };
      MW.grid.render();
      MW.touchStatus("selection", ["selection"]);
    };
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[48px]", children: "SELECT:" }),
        Array.from({ length: 16 }, (_3, t3) => /* @__PURE__ */ a3(
          B3,
          {
            onClick: () => {
              app.selectedTracks[t3] = !app.selectedTracks[t3];
              MW.touchStatus("selection", ["selectedTracks"]);
            },
            on: !!app.selectedTracks[t3],
            cls: "flex-1 px-0",
            children: t3.toString(16).toUpperCase()
          },
          t3
        )),
        /* @__PURE__ */ a3(B3, { onClick: () => {
          for (let t3 = 0; t3 < 16; t3++) app.selectedTracks[t3] = true;
          MW.touchStatus("selection", ["selectedTracks"]);
        }, cls: "w-[30px]", children: "SET" }),
        /* @__PURE__ */ a3(B3, { onClick: () => {
          for (let t3 = 0; t3 < 16; t3++) app.selectedTracks[t3] = false;
          MW.touchStatus("selection", ["selectedTracks"]);
        }, cls: "w-[30px]", children: "CLR" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { onClick: selectTrack, cls: "w-[82px]", children: "SELECT TRACK" }),
        /* @__PURE__ */ a3(B3, { act: "rng-cut", cls: "w-[42px]", children: "CUT" }),
        /* @__PURE__ */ a3(B3, { act: "rng-copy", cls: "w-[46px]", children: "COPY" }),
        /* @__PURE__ */ a3(B3, { act: "rng-paste", cls: "w-[46px]", children: "PASTE" }),
        /* @__PURE__ */ a3(B3, { act: "rng-paste", cls: "w-[78px]", children: "PASTE SELECT" }),
        /* @__PURE__ */ a3(B3, { act: "chord-toggle", on: !!app.chordMode, cls: "w-[48px]", children: "CHORD" }),
        /* @__PURE__ */ a3(B3, { act: "chord-rst", cls: "w-[32px]", children: "RST" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "sel-all", cls: "w-[82px]", children: "SELECT BLOCK" }),
        /* @__PURE__ */ a3(B3, { act: "rng-clear", cls: "w-[46px]", children: "CLEAR" }),
        /* @__PURE__ */ a3(B3, { act: "sel-cancel", cls: "w-[52px]", children: "CANCEL" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[54px]", children: "SPREAD:" }),
        /* @__PURE__ */ a3(B3, { act: "spread-2", cls: "w-[20px]", children: "2" }),
        /* @__PURE__ */ a3(B3, { act: "spread-3", cls: "w-[20px]", children: "3" }),
        /* @__PURE__ */ a3(B3, { act: "spread-4", cls: "w-[20px]", children: "4" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[44px]", children: "SLIDE:" }),
        /* @__PURE__ */ a3(B3, { act: "mk-slide1", cls: "w-[20px]", children: "1" }),
        /* @__PURE__ */ a3(B3, { act: "mk-slide2", cls: "w-[20px]", children: "2" }),
        /* @__PURE__ */ a3(B3, { act: "mk-volslide", cls: "w-[34px]", children: "VOL" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "note-echo", cls: "w-[64px]", children: "NOTE ECHO" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[34px]", children: "DIST" }),
        /* @__PURE__ */ a3(N2, { id: "echo-dist", value: echoDist, min: 1, max: 16, onChange: setEchoDist, cls: "w-[30px]" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[30px]", children: "MIN" }),
        /* @__PURE__ */ a3(N2, { id: "echo-min", value: echoMin, min: 1, max: 64, onChange: setEchoMin, cls: "w-[30px]" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[44px]", children: "RANGE:" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] flex-1 items-center border border-ink bg-paper px-1 text-[10px]", children: rangeText })
      ] })
    ] });
  }
  function TransPanel() {
    useKeys(["cursor", "currentIns"]);
    const app = MW.app;
    const scope = app.transposeScope || "block";
    const instScope = app.transposeInstrScope || "all";
    const setPlay = (v3) => {
      app.song.playtransp = MW.clamp(v3, -24, 24);
      MW.panels.refresh();
    };
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[48px]", children: "AFFECT:" }),
        [["song", "SONG"], ["block", "BLOCK"], ["track", "TRACK"], ["sel", "SEL.TRKS"], ["range", "RANGE"]].map(([k2, l3]) => /* @__PURE__ */ a3(B3, { act: `scope-${k2}`, on: scope === k2, cls: "flex-1", children: l3 }, k2)),
        /* @__PURE__ */ a3(L2, { cls: "w-[42px]", children: "INSTR:" }),
        /* @__PURE__ */ a3(B3, { act: "instscope-all", on: instScope === "all", cls: "w-[40px]", children: "ALL" }),
        /* @__PURE__ */ a3(B3, { act: "instscope-curr", on: instScope === "curr", cls: "w-[46px]", children: "CURR" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[40px]", children: "INSTR:" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[40px]", children: "NOTE:" }),
        /* @__PURE__ */ a3("input", { id: "tr-from", type: "number", min: "1", max: "120", value: "1", class: `${FIELD} w-[40px]` }),
        /* @__PURE__ */ a3(B3, { act: "note-change", cls: "w-[26px]", children: "\u2192" }),
        /* @__PURE__ */ a3("input", { id: "tr-to", type: "number", min: "1", max: "120", value: "1", class: `${FIELD} w-[40px]` }),
        /* @__PURE__ */ a3(B3, { act: "note-exchange", cls: "w-[26px]", children: "\u21C4" }),
        /* @__PURE__ */ a3(B3, { act: "tr-up", cls: "w-[38px]", children: "1/2\u2191" }),
        /* @__PURE__ */ a3(B3, { act: "tr-down", cls: "w-[38px]", children: "1/2\u2193" }),
        /* @__PURE__ */ a3(B3, { act: "tr-up12", cls: "w-[38px]", children: "OCT\u2191" }),
        /* @__PURE__ */ a3(B3, { act: "tr-down12", cls: "w-[38px]", children: "OCT\u2193" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "ins-delete", cls: "w-[34px]", children: "DEL" }),
        /* @__PURE__ */ a3("input", { id: "tr-ins-from", type: "number", min: "1", max: "63", value: app.currentIns, class: `${FIELD} w-[36px]` }),
        /* @__PURE__ */ a3(B3, { act: "ins-change", cls: "w-[26px]", children: "\u2192" }),
        /* @__PURE__ */ a3("input", { id: "tr-ins-to", type: "number", min: "1", max: "63", value: "1", class: `${FIELD} w-[36px]` }),
        /* @__PURE__ */ a3(B3, { act: "ins-exchange", cls: "w-[26px]", children: "\u21C4" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[100px]", children: "PLAY TRANSPOSE:" }),
        /* @__PURE__ */ a3(
          "input",
          {
            type: "range",
            min: "-24",
            max: "24",
            value: app.song.playtransp || 0,
            class: "h-[20px] min-w-0 flex-1",
            onChange: (e3) => setPlay(+e3.currentTarget.value)
          }
        ),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]", children: app.song.playtransp || 0 })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[34px]", children: "TEXT:" }),
        /* @__PURE__ */ a3(T3, { value: app.song.annotation || "", onInput: (v3) => {
          app.song.annotation = v3;
        }, cls: "flex-1" })
      ] })
    ] });
  }
  function MidiPanel() {
    useKeys(["currentIns"]);
    const app = MW.app;
    const inst = app.song.instruments[app.currentIns - 1];
    const msg = app.midiMessages && app.midiMessages[app.midiMsgIndex] ? app.midiMessages[app.midiMsgIndex] : { name: "", data: [] };
    const hexData = (msg.data || []).map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
    const setHex = (v3) => {
      const bytes = (v3.match(/[0-9a-fA-F]{2}/g) || []).map((x2) => parseInt(x2, 16) & 255);
      msg.data = bytes;
      MW.panels.refresh();
    };
    const midi = MW.midi || { supported: false, enabled: false, outputs: [], inputs: [] };
    const ch = inst ? inst.midiChannel || 0 : 0;
    const mapEntry = app.midiMap && app.midiMap[app.midiMapIndex];
    const mapName = mapEntry && mapEntry.kind === "fn" ? mapEntry.fn : "note";
    const setCh = (n2) => {
      const i3 = app.song.instruments[app.currentIns - 1];
      if (i3) {
        i3.midiChannel = n2;
        MW.panels.refresh();
      }
    };
    return /* @__PURE__ */ a3("div", { class: "flex h-full flex-col gap-px", children: [
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[52px]", children: "MIDI CH:" }),
        /* @__PURE__ */ a3(B3, { onClick: () => setCh(0), on: ch === 0, cls: "w-[54px]", children: "NO MIDI" }),
        Array.from({ length: 16 }, (_3, i3) => /* @__PURE__ */ a3(B3, { onClick: () => setCh(i3 + 1), on: ch === i3 + 1, cls: "flex-1 px-0", children: i3 + 1 }, i3))
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[82px]", children: "MIDI PRESET #:" }),
        /* @__PURE__ */ a3(
          N2,
          {
            value: inst ? inst.midiPreset || 0 : 0,
            min: 0,
            max: 128,
            onChange: (v3) => {
              const i3 = app.song.instruments[app.currentIns - 1];
              if (i3) i3.midiPreset = v3;
            },
            cls: "w-[40px]"
          }
        ),
        /* @__PURE__ */ a3(
          "select",
          {
            class: "h-[20px] min-w-0 flex-1 border border-ink bg-paper px-1 text-[10px]",
            onChange: (e3) => {
              if (midi.outputs[e3.currentTarget.value]) midi.port = midi.outputs[e3.currentTarget.value];
            },
            children: [
              midi.outputs.map((o4, i3) => /* @__PURE__ */ a3("option", { value: i3, children: o4.name })),
              !midi.outputs.length && /* @__PURE__ */ a3("option", { children: "no outputs" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "midi-enable", on: !!midi.enabled, cls: "w-[72px]", children: "MIDI ACTIVE" }),
        /* @__PURE__ */ a3(B3, { act: "midi-input", on: !!app.midiInput, cls: "w-[44px]", children: "INPUT" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[52px]", children: "CHANNEL" }),
        /* @__PURE__ */ a3(N2, { value: app.midiInChannel || 0, min: 0, max: 16, onChange: (v3) => {
          app.midiInChannel = v3;
        }, cls: "w-[32px]" }),
        /* @__PURE__ */ a3(B3, { act: "midi-sendout", on: !!app.midiSendOut, cls: "w-[54px]", children: "SEND OUT" }),
        /* @__PURE__ */ a3(B3, { act: "midi-suppress", on: !!(inst && inst.suppressOff), cls: "w-[70px]", children: "SUPPR.N.OFF" }),
        /* @__PURE__ */ a3(B3, { act: "midi-alloff-cc", on: MW.app.midiAllOff !== "note", cls: "w-[30px]", children: "OFF" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "midi-sync", on: !!MW.player.sync, cls: "w-[62px]", children: "SEND SYNC" }),
        /* @__PURE__ */ a3(B3, { act: "midi-extsync", on: !!app.extSync, cls: "w-[58px]", children: "EXT SYNC" }),
        /* @__PURE__ */ a3(B3, { act: "midi-sensing", on: MW.midi.sensingOn !== false, cls: "w-[70px]", children: "ACT.SENSING" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[48px]", children: "ALL OFF:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-alloff-cc", on: MW.app.midiAllOff !== "note", cls: "w-[58px]", children: "$Bx7B00" }),
        /* @__PURE__ */ a3(B3, { act: "midi-alloff-note", on: MW.app.midiAllOff === "note", cls: "w-[58px]", children: "N.OFF:S" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[40px]", children: "READ:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-keyup", on: !!app.midiKeyUp, cls: "w-[48px]", children: "KEY-UP" }),
        /* @__PURE__ */ a3(B3, { act: "midi-vel", on: !!app.readVelocity, cls: "w-[48px]", children: "VOLUME" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[44px]", children: "RESET:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-reset-pb", cls: "w-[54px]", children: "PB+PRES" }),
        /* @__PURE__ */ a3(B3, { act: "midi-reset-ff", cls: "w-[34px]", children: "$FF" }),
        /* @__PURE__ */ a3(B3, { act: "midi-lc-on", cls: "w-[54px]", children: "LOC.CTRL" }),
        /* @__PURE__ */ a3(B3, { act: "midi-lc-off", cls: "w-[34px]", children: "OFF" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[42px]", children: "MSG #:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-prev", cls: "w-[20px]", children: "<" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[32px] items-center justify-center border border-ink bg-paper text-[11px]", children: [
          (app.midiMsgIndex || 0) + 1,
          "/",
          app.midiMessages.length
        ] }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-next", cls: "w-[20px]", children: ">" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-new", cls: "w-[34px]", children: "NEW" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-insert", cls: "w-[52px]", children: "N.HERE" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-del", cls: "w-[34px]", children: "DEL" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-clear", cls: "w-[44px]", children: "CLEAR" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[54px]", children: "MSG SIZE:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-dec", cls: "w-[20px]", children: "<" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[30px] items-center justify-center border border-ink bg-paper text-[11px]", children: msg.data.length }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-inc", cls: "w-[20px]", children: ">" }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-capture", on: !!app.midiCapture, cls: "w-[40px]", children: "CAPT." }),
        /* @__PURE__ */ a3(B3, { act: "midi-msg-send", cls: "w-[42px]", children: "SEND" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(B3, { act: "midi-msg-auto", on: app.midiMsgAuto !== false, cls: "w-[92px]", children: "AUTO-TERMINATE" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[38px]", children: "NAME:" }),
        /* @__PURE__ */ a3(T3, { value: msg.name || "", maxlength: 40, onInput: (v3) => {
          msg.name = v3;
        }, cls: "flex-1" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[36px]", children: "DATA:" }),
        /* @__PURE__ */ a3(T3, { value: hexData, onInput: setHex, cls: "flex-1", placeholder: "F0 ... F7" })
      ] }),
      /* @__PURE__ */ a3(R, { children: [
        /* @__PURE__ */ a3(L2, { cls: "w-[30px]", children: "MAP:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-map-active", on: !!app.midiMapActive, cls: "w-[44px]", children: "ACTIVE" }),
        /* @__PURE__ */ a3(B3, { act: "midi-map-reset", cls: "w-[42px]", children: "RESET" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[40px]", children: "FUNCT:" }),
        /* @__PURE__ */ a3(B3, { act: "midi-map-prev", cls: "w-[20px]", children: "<" }),
        /* @__PURE__ */ a3("span", { class: "flex h-[20px] w-[72px] items-center justify-center border border-ink bg-paper text-[10px]", children: mapName }),
        /* @__PURE__ */ a3(B3, { act: "midi-map-next", cls: "w-[20px]", children: ">" }),
        /* @__PURE__ */ a3(B3, { act: "midi-map-new", cls: "w-[32px]", children: "NEW" }),
        /* @__PURE__ */ a3(B3, { act: "midi-map-del", cls: "w-[32px]", children: "DEL" }),
        /* @__PURE__ */ a3(B3, { act: "midi-dump-save", cls: "w-[52px]", children: "SAVE DUMP" }),
        /* @__PURE__ */ a3(B3, { act: "midi-dump-load", cls: "w-[52px]", children: "LOAD DUMP" }),
        /* @__PURE__ */ a3(L2, { cls: "w-[26px]", children: "KEY" }),
        /* @__PURE__ */ a3(N2, { value: app.midiMapIndex, min: 0, max: 127, onChange: (v3) => {
          app.midiMapIndex = v3;
          MW.panels.refresh();
        }, cls: "w-[38px]" })
      ] }),
      /* @__PURE__ */ a3("div", { class: "max-h-[84px] overflow-auto border border-ink bg-paper", children: Array.from({ length: 128 }, (_3, i3) => {
        const entry = app.midiMap && app.midiMap[i3];
        const label = entry && entry.kind === "fn" ? entry.fn : "note";
        return /* @__PURE__ */ a3(
          "button",
          {
            type: "button",
            class: `flex w-full items-center gap-2 px-1 text-left text-[10px] leading-[14px] ${i3 === app.midiMapIndex ? "bg-ink text-paper" : ""}`,
            onClick: () => {
              app.midiMapIndex = i3;
              MW.panels.refresh();
            },
            children: [
              /* @__PURE__ */ a3("span", { class: "w-[26px] text-right", children: i3 }),
              /* @__PURE__ */ a3("span", { class: "w-[34px]", children: MW.noteName(i3 - 23, app.hb) }),
              /* @__PURE__ */ a3("span", { children: label })
            ]
          },
          i3
        );
      }) })
    ] });
  }
  var PANELS = {
    play: PlayPanel,
    files: FilesPanel,
    instr: InstrPanel,
    block: BlockPanel,
    edit: EditPanel,
    misc: MiscPanel,
    vol: VolPanel,
    range: RangePanel,
    transp: TransPanel,
    midi: MidiPanel
  };
  var active = "play";
  var listeners = /* @__PURE__ */ new Set();
  var emit = () => listeners.forEach((fn) => fn());
  function Host() {
    const [, force] = _2((n2) => n2 + 1, 0);
    A(() => {
      const bump = () => force(0);
      listeners.add(bump);
      return () => {
        listeners.delete(bump);
      };
    }, []);
    const Panel = PANELS[active] || PlayPanel;
    return /* @__PURE__ */ a3(Panel, {});
  }
  MW.panels = {
    get current() {
      return active;
    },
    mount(host) {
      K(/* @__PURE__ */ a3(Host, {}), host);
      const left = document.querySelector(".deck-left");
      if (left) left.style.display = "block";
    },
    show(name) {
      active = name;
      document.querySelectorAll("#rail button").forEach((b) => {
        b.classList.toggle("active", b.dataset.panel === name);
      });
      const left = document.querySelector(".deck-left");
      if (left) left.style.display = name === "play" ? "block" : "none";
      emit();
    },
    refresh() {
      emit();
    }
  };
})();
