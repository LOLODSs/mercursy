import { isMobile } from './mq.js'
import { SceneLayout, mercuryGeometry, constrainBall } from './scene-layout.js'
/* Живая ртуть: чистый WebGL без three.js (−500 КБ JS).
   Один полноэкранный треугольник + raymarching метаболов.
   Оптимизации: луч, не задевший ни одну каплю (с запасом на сглаживание и тень),
   не маршится вовсе; марш идёт только внутри [tmin, tmax] ограничивающих сфер;
   постер без перехода читается одной выборкой текстуры. Картинка — та же. */

const N = 10 // ball 0 = cursor
const H = 2.4 // half visible height at z=0  (camera z=6, tan = .4)
const PAD = 0.75 // запас: smin(k=.62) раздувает поле максимум на k/4, плюс рябь .022 и ореол тени md<.4

const vert = `attribute vec2 aP; varying vec2 vUv; void main(){ vUv=aP*.5+.5; gl_Position=vec4(aP,0.,1.); }`
function getFrag(mobile) {
  const steps = mobile ? 32 : 38
  const hitEps = mobile ? '0.0016' : '0.0015'
  return `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform vec4 uB[${N}];
uniform vec4 uSafe; uniform float uBounded; uniform float uShapeScale;
uniform sampler2D uA; uniform sampler2D uBt; uniform float uMix;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float map(vec3 p){
  float d=1e3;
  for(int i=0;i<${N};i++){ vec4 b=uB[i]; d=smin(d,length(p-b.xyz)-b.w,.62*uShapeScale); }
  d+=sin(p.x*5.+uTime*1.3)*sin(p.y*4.+uTime)*sin(p.z*5.+uTime*.7)*.022*uShapeScale;
  return d;
}
vec3 nrm(vec3 p){const vec2 e=vec2(.0025,-.0025);
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
float tmask(vec2 uv){
  float n=vnoise(uv*vec2(uRes.x/uRes.y,1.)*3.2)*.72+vnoise(uv*18.)*.28;
  return smoothstep(n-.07,n+.07,uMix*1.22-.11);
}
vec3 poster(vec2 uv){
  if(uMix<=0.) return texture2D(uA,uv).rgb; // вне перехода маска = 0 и подтёки = 0
  float melt=sin(uMix*3.14159);
  float drip=(vnoise(vec2(uv.x*9.,2.))-.2)*.07*melt;
  vec3 a=texture2D(uA,uv+vec2(0.,drip)).rgb;
  vec3 b=texture2D(uBt,uv-vec2(0.,drip*.6)).rgb;
  return mix(a,b,tmask(uv));
}
// преломление с хроматикой: три канала со сдвигом r, 1.05r, 1.1r
vec3 poster3(vec2 uv,vec2 r){
  vec2 u0=uv-r, u1=uv-r*1.05, u2=uv-r*1.1;
  if(uMix<=0.) return vec3(texture2D(uA,u0).r,texture2D(uA,u1).g,texture2D(uA,u2).b);
  float melt=sin(uMix*3.14159);
  float drip=(vnoise(vec2(u1.x*9.,2.))-.2)*.07*melt;
  vec2 da=vec2(0.,drip), db=vec2(0.,drip*.6);
  vec3 a=vec3(texture2D(uA,u0+da).r,texture2D(uA,u1+da).g,texture2D(uA,u2+da).b);
  vec3 b=vec3(texture2D(uBt,u0-db).r,texture2D(uBt,u1-db).g,texture2D(uBt,u2-db).b);
  return mix(a,b,tmask(u1));
}
vec3 pal(float t){return .5+.5*cos(6.2831*(t+vec3(0.,.33,.67)));}
vec3 env(vec3 d){
  vec3 c=vec3(.012);
  c+=vec3(1.)*smoothstep(.5,.92,d.y)*1.25;
  c+=vec3(.85,.93,1.)*smoothstep(.72,.98,d.x)*.9;
  c+=vec3(1.,.86,.8)*smoothstep(.78,.99,-d.x)*.45;
  c+=vec3(.6,.7,.9)*smoothstep(.6,.95,-d.y)*.12;
  c+=pal(d.y*.7+d.x*.35+uTime*.03)*.2*(1.-abs(d.y));
  return c;
}
void main(){
  vec2 fc=vUv*uRes; vec2 p=(fc-.5*uRes)/uRes.y;
  vec3 col=poster(vUv); vec3 original=col;
  float edge=min(min((vUv.x-uSafe.x)*uRes.x,(uSafe.z-vUv.x)*uRes.x),min((vUv.y-uSafe.y)*uRes.y,(uSafe.w-vUv.y)*uRes.y));
  float safe=uBounded<.5?1.:smoothstep(0.,6.,edge);
  if(safe<=0.){
    col*=1.-.38*length(vUv-.5);
    float lum=dot(col,vec3(.299,.587,.114));
    col+=(hash(fc+fract(uTime))-.5)*mix(.006,0.,smoothstep(.15,.5,lum));
    gl_FragColor=vec4(col,1.);return;
  }
  vec3 ro=vec3(0.,0.,6.), rd=normalize(vec3(p*.8,-1.));
  // ограничивающие сферы: где луч их не задевает, поле > .4 — ни капли, ни тени
  float t0=1e3, t1=-1.;
  for(int i=0;i<${N};i++){ vec4 b=uB[i]; vec3 oc=ro-b.xyz; float R=b.w+${PAD.toFixed(2)}*(uBounded>.5?uShapeScale:1.);
    float bb=dot(oc,rd), h=bb*bb-dot(oc,oc)+R*R;
    if(h>0.){ h=sqrt(h); t0=min(t0,-bb-h); t1=max(t1,-bb+h); } }
  if(t1>0. && safe>0.){
    float t=max(t0,0.), md=1e3; bool hit=false; t1=min(t1,9.);
    for(int i=0;i<${steps};i++){ vec3 q=ro+rd*t; float d=map(q); md=min(md,d); if(d<${hitEps}){hit=true;break;} t+=d*.95; if(t>t1)break; }
    vec3 bgCol=col*(.5+.5*smoothstep(0.,.4*uShapeScale,md));
    if(hit){
      vec3 q=ro+rd*t; vec3 n=nrm(q);
      float ndotv=max(dot(-rd,n),0.);
      float fr=pow(1.-ndotv,2.4);
      vec2 r=n.xy*(.07+.05*(1.-fr));
      vec3 refr=poster3(vUv,r);
      vec3 R=reflect(rd,n);
      vec3 mercury=refr*(.8-fr*.4)+env(R)*(.5+fr*1.0);
      mercury+=pal(fr*1.2+n.y*.3+uTime*.03)*pow(fr,1.5)*.25;
      mercury+=pow(max(dot(R,normalize(vec3(.35,.8,.55))),0.),70.)*1.4;
      float edgeAlpha=smoothstep(0.,.07,ndotv);
      col=mix(bgCol,mercury,edgeAlpha);
    } else {
      col=bgCol;
    }
  }
  col=mix(original,col,safe);
  col*=1.-.38*length(vUv-.5);
  float lum=dot(col,vec3(.299,.587,.114));
  col+=(hash(fc+fract(uTime))-.5)*mix(.006,0.,smoothstep(.15,.5,lum));
  gl_FragColor=vec4(col,1.);
}`
}

export class Liquid {
  constructor(el) {
    this.el = el
    const cv = this.canvas = document.createElement('canvas')
    el.appendChild(cv)
    this.mobile = isMobile()
    this.maxQ = this.mobile ? 0.8 : 1.0
    this.quality = this.maxQ
    this.cA = null; this.cB = null; this.cache = new Map(); this.pool = []
    this.uB = new Float32Array(N * 4)
    this.chapter = 'home'
    this.mouse = { x: 0, y: 0, active: false }
    this.balls = Array.from({ length: N }, (_, i) => ({ x: (Math.random() - 0.5) * 3, y: H * 1.3 + Math.random() * 0.8, z: 0, r: 0.01, vx: 0, vy: 0, vz: 0, k: 3 + (i % 5) * 0.9, tr: 0.01 }))
    this.trans = null; this.draw = null; this.mix = 0
    this.fr = { n: 0, sum: 0, good: 0, slow: 0, hold: performance.now() + 1500 }
    this.ceil = this.maxQ; this.ceilAt = 0
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.initGL()
    cv.addEventListener('webglcontextlost', this.onLost = (e) => { e.preventDefault(); this.gl = null; this.stop() })
    cv.addEventListener('webglcontextrestored', this.onRestored = () => { this.initGL(); this.size(true); this.cA && this.upload(0, this.cA); this.cB && this.upload(1, this.cB); this.start() })
    this.size(true)
    let rt; this.onResize = () => { this.size(true); clearTimeout(rt); rt = setTimeout(() => { this.size(true); this.repaint() }, 120) }
    addEventListener('resize', this.onResize)
    this.t0 = performance.now(); this.last = this.t0
    this.loop = (now) => { this.raf = requestAnimationFrame(this.loop); this.tick(now) }
    this.paused = 0
    this.layout = new SceneLayout(next => { if(next.bounded || this.sceneWasBounded){this.snapScene=true;this.mouse.active=false} this.sceneWasBounded=next.bounded })
    this.start()
    // пауза, когда вкладка скрыта — не жрём батарею
    this.onVis = () => (document.hidden ? this.stop() : this.start())
    document.addEventListener('visibilitychange', this.onVis)
  }
  initGL() {
    const o = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }
    const gl = this.gl = this.canvas.getContext('webgl', o) || this.canvas.getContext('experimental-webgl', o)
    if (!gl) throw new Error('no webgl')
    this.initProgram()
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.tex = [0, 1].map((u) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([6, 6, 6, 255]))
      return t
    })
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    this.texSize = []
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND)
  }
  initProgram() {
    const gl = this.gl
    if (this.pr) gl.deleteProgram(this.pr)
    const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(x)); return x }
    const pr = this.pr = gl.createProgram()
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vert)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, getFrag(this.mobile)))
    gl.bindAttribLocation(pr, 0, 'aP'); gl.linkProgram(pr)
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(pr))
    gl.useProgram(pr)
    const L = (n) => gl.getUniformLocation(pr, n)
    this.L = { res: L('uRes'), time: L('uTime'), mix: L('uMix'), b: L('uB'), a: L('uA'), bt: L('uBt'), safe: L('uSafe'), bounded: L('uBounded'), shape: L('uShapeScale') }
    gl.uniform1i(this.L.a, 0); gl.uniform1i(this.L.bt, 1)
  }
  // текстурный юнит 0 — текущий постер (uA), 1 — следующий (uBt)
  upload(unit, c) {
    const gl = this.gl; if (!gl || !c?.width) return
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, this.tex[unit])
    // тот же размер — обновляем на месте без перевыделения памяти видеокарты
    const k = c.width + 'x' + c.height
    if (this.texSize?.[unit] === k) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c)
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); (this.texSize ||= [])[unit] = k }
  }
  start() { if (!this.raf && !this.paused && !document.hidden && this.gl) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop) } }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null }
  // App ставит на паузу, когда ртуть всё равно закрыта (открыт кейс)
  pause() { this.paused = 1; this.stop() }
  resume() { this.paused = 0; this.start() }
  dpr() {
    const raw = devicePixelRatio || 1
    if (this.mobile) {
      const d = Math.min(raw, 1.15)
      const maxDim = Math.max(innerWidth, innerHeight) * d
      return maxDim > 1280 ? Math.max(0.85, 1280 / Math.max(innerWidth, innerHeight)) : d
    }
    const d = Math.min(Math.max(raw, 1), 1.25)
    const maxDim = Math.max(innerWidth, innerHeight) * d
    return maxDim > 1920 ? Math.max(1, 1920 / Math.max(innerWidth, innerHeight)) : d
  }
  // размер буфера рендера: меняется и от ресайза, и от губернатора качества
  size(force = false) {
    const w = innerWidth, h = innerHeight
    const d = this.dpr()
    const cw = Math.max(1, Math.round(w * d * this.quality)), ch = Math.max(1, Math.round(h * d * this.quality))
    if (force || Math.abs(this.canvas.width - cw) >= 16 || Math.abs(this.canvas.height - ch) >= 16) {
      this.canvas.width = cw; this.canvas.height = ch
    }
    const actualW = this.canvas.width, actualH = this.canvas.height
    this.res = [actualW, actualH]
    if (this.gl) { this.gl.viewport(0, 0, actualW, actualH); this.gl.uniform2f(this.L.res, actualW, actualH) }
  }
  /* Постеры: на десктопе точно соответствуют DPR экрана (1:1 пиксель-в-пиксель,
     без билинейного размытия и алиасинга шрифтов). */
  posterScale() {
    const raw = devicePixelRatio || 1
    return Math.min(raw, this.mobile ? 1.15 : 1.25)
  }
  canvasFor() {
    const c = this.pool.pop() || document.createElement('canvas')
    const ts = this.posterScale(), w = Math.round(innerWidth * ts), h = Math.round(innerHeight * ts)
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    return c
  }
  release(c) { if (c && this.pool.length < 1) this.pool.push(c) }
  posterCanvas(fn) {
    let c = this.cache.get(fn)
    if (!c) {
      c = this.canvasFor()
      this.paint(c, fn)
      this.cache.set(fn, c)
    }
    return c
  }
  // App сообщает соседние главы — дорисуем их, когда браузер будет свободен
  prefetch(fns) {
    this.want = fns.filter(Boolean)
    this.schedule()
  }
  schedule() {
    if (this.idleId) return
    const run = () => {
      this.idleId = 0
      if (this.trans) { this.idleId = setTimeout(run, 400); return } // не мешаем переходу
      const fn = (this.want || []).find((f) => f !== this.draw && !this.cache.has(f))
      if (!fn) return
      const c = this.canvasFor(); this.paint(c, fn); this.cache.set(fn, c)
      this.schedule()
    }
    this.idleId = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 300)
  }
  repaint() {
    const was = this.mobile; this.mobile = isMobile()
    if (was !== this.mobile) {
      this.maxQ = this.mobile ? 0.85 : 1.0; this.quality = Math.min(this.quality, this.maxQ); this.ceil = this.maxQ
      if (this.gl) { try { this.initProgram() } catch (e) {} }
      this.size(true)
    }
    for (const c of this.cache.values()) this.release(c)
    this.cache.clear()
    if (this.draw) { this.cA = this.canvasFor(); this.paint(this.cA, this.draw); this.upload(0, this.cA) }
    if (this.trans) { this.cB = this.canvasFor(); this.paint(this.cB, this.trans.draw); this.upload(1, this.cB) }
    this.schedule()
  }
  resize() { this.size(true); this.repaint() }
  paint(c, fn) {
    const ctx = c.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    fn(ctx, c.width, c.height, this.mobile)
  }
  setPoster(fn) {
    
    this.layout?.setChapter(this.chapter)
    this.draw = fn; this.cA = this.posterCanvas(fn); this.upload(0, this.cA)
  }
  transitionTo(fn, chapter) {
    if (this.trans) this.finish()
    this.cB = this.posterCanvas(fn); this.upload(1, this.cB)
    this.trans = { draw: fn, start: performance.now(), dur: this.reduce ? 10 : 1500 }
    this.fr.hold = performance.now() + 250
    this.chapter = chapter
    this.layout?.setChapter(this.chapter)
    this.splash(this.mobile ? 1.6 : 2.5)
  }
  finish() {
    const t = this.trans; if (!t) return
    // старый постер не выбрасываем: это сосед новой главы, пригодится при листании назад
    
    this.cA = this.cB; this.cB = null
    if (this.gl) {
      ;[this.tex[0], this.tex[1]] = [this.tex[1], this.tex[0]]
      if (this.texSize) this.texSize.reverse()
      const gl = this.gl
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0])
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1])
    }
    this.draw = t.draw; this.trans = null; this.mix = 0
    if (this.want) this.prefetch(this.want)
  }
  setMouse(cx, cy) {
    if (this.layout?.current?.bounded && !this.mobile) { this.mouse.active = false; return }
    const W = H * innerWidth / innerHeight
    let mx = (cx / innerWidth * 2 - 1) * W
    let my = -(cy / innerHeight * 2 - 1) * H
    if (this.mobile) {
      mx = Math.max(-W * 0.82, Math.min(W * 0.82, mx))
      my = Math.max(-H * 0.68, Math.min(H * 0.76, my))
    }
    this.mouse.x = mx
    this.mouse.y = my
    this.mouse.active = true
  }
  setMouseActive(active) {
    this.mouse.active = !!active
  }
  splash(power = 5) {
    const p = this.mobile ? Math.min(power, 2.0) : power
    this.balls.forEach((b, i) => { if (!i) return; const a = Math.random() * 6.283; b.vx += Math.cos(a) * p; b.vy += Math.sin(a) * p; b.vz += (Math.random() - 0.5) * p })
  }
  targets(t) {
    this.shapeScale = 1
    const asp = innerWidth / innerHeight, W = H * asp, m = this.mobile
    const s = m ? 0.62 : Math.min(1, Math.max(0.7, asp / 1.6))
    const R = [0.62, 0.44, 0.36, 0.3, 0.26, 0.22, 0.19, 0.16, 0.13].map((r) => r * s)
    const out = []
    const ch = this.chapter
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4 + t * (0.18 + i * 0.045)
      let x, y, z = Math.sin(a) * 0.35, r = R[i]
      if (ch === 'home') {
        // на телефоне ртуть парит точно по центру в свободном окне между «ЖИВОЕ» и текстом описания
        const cx = m ? 0 : W * 0.4, cy = m ? -H * 0.05 : -H * 0.06
        const d = (0.15 + i * 0.13) * s * (m ? 0.6 : 1.25)
        x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d * (m ? 0.35 : 0.8)
        r *= m ? 0.65 : 1
      } else if (ch === 'services') {
        if (m) {
          // на телефоне ртуть парит в верхней свободной зоне вокруг контурного слова «БОТЫ»
          const cx = 0, cy = H * 0.36
          const d = (0.16 + (i % 4) * 0.12) * s * 0.8
          x = cx + Math.cos(a) * d * 1.3; y = cy + Math.sin(a) * d * 0.45
          r = (0.28 + (i % 3) * 0.1) * s * 0.85
        } else {
          if (i < 3) {
            const lx = [-0.55, -0.18, -0.36][i]
            x = lx * W + Math.sin(t * 0.35 + i * 2.1) * 0.05 * W
            y = -H * (0.92 + (i % 3) * 0.03) + Math.cos(t * 0.3 + i) * 0.03 * H
            r = 0.3 * (i === 2 ? 0.85 : 1)
          } else {
            const j = i - 3
            x = -0.35 * W - j * 0.04 * W + Math.cos(a) * 0.06 * W
            y = -H * 0.9 + Math.sin(a) * 0.05 * H; r *= 0.7
          }
        }
      } else if (ch === 'works') {
        // на телефоне капли мягко текут под/вокруг слова «РАБОТЫ» НАД карточками кейсов
        x = -W * 0.85 + (i / 8) * W * 1.7 + Math.sin(t * 0.6 + i) * (m ? 0.08 : 0.15)
        y = (m ? 0.52 : 0.55) * H + Math.sin(t * 0.8 + i) * (m ? 0.06 : 0.2) * H
        r = (0.16 + ((i * 37) % 9) / 9 * 0.24) * s * (m ? 0.6 : 1.3)
      } else if (ch === 'process') {
        // на телефоне ртуть располагается в верхней зоне вокруг «КАК Я РАБОТАЮ»
        const cx = m ? 0 : W * 0.62, cy = m ? H * 0.40 : H * 0.45
        const d = (0.2 + i * 0.09) * s * (m ? 0.65 : 1)
        x = cx + Math.cos(a * 0.7) * d * (m ? 0.9 : 1.6); y = cy + Math.sin(a * 0.7) * d * 0.4; r *= m ? 0.42 : 0.8
      } else if (ch === 'reviews') {
        // на телефоне ртуть парит в верхней зоне вокруг заголовка
        const cx = m ? 0 : W * 0.66, cy = m ? H * 0.42 : H * 0.36
        const aa = i / 9 * 6.283 + t * 0.2
        x = cx + Math.cos(aa) * 0.36 * s * (m ? 1.1 : 1); y = cy + Math.sin(aa) * 0.25 * s * (m ? 0.5 : 1); r *= (i % 3 ? 0.6 : 0.95) * (m ? 0.58 : 1)
      } else if (ch === 'about') {
        // на телефоне шар компактно парит в верхней свободной зоне вокруг заголовка
        const cx = m ? 0 : W * 0.48, cy = m ? H * 0.42 : 0
        const rr = (m ? 0.34 : 0.85) * s
        const aa = i / 9 * 6.283 + t * 0.25
        x = cx + Math.cos(aa) * rr * (m ? 0.9 : 1.2); y = cy + Math.sin(aa) * rr * (m ? 0.6 : 1); z = Math.sin(aa * 2 + t) * 0.4; r *= m ? 0.44 : 0.75
      } else {
        // контакт: парит в свободной зоне между заголовком и кнопками
        const cx = m ? 0 : W * 0.52, cy = m ? H * 0.26 : H * 0.05
        x = cx + Math.cos(a) * 0.3 * s * (m ? 0.75 : 1); y = cy + Math.sin(a) * 0.26 * s * (m ? 0.65 : 1); r = (0.42 + (i % 3) * 0.1) * s * (m ? 0.48 : 1)
      }
      out.push([x, y, z, r])
    }
    return out
  }
  // губернатор: окно ~45 кадров (или ~1 с, если кадры совсем медленные). Цель — ровные 60 fps: дольше ~20.5 мс на кадр → снижаем разрешение рендера,
  // стабильно быстрее 17.6 мс → возвращаем (не выше исходного). После просадки потолок временно ниже —
  // чтобы качество не «качалось» туда-сюда. Первые секунды после загрузки/смены главы не считаем.
  govern(dt, now) {
    const f = this.fr
    if (now < f.hold) { f.n = 0; f.sum = 0; return }
    f.n++; f.sum += dt
    if (f.n < 45 && !(f.sum > 1 && f.n >= 8)) return // окно: 45 кадров или ~1 с на медленном устройстве
    const avg = f.sum / f.n; f.n = 0; f.sum = 0
    // качество уже на минимуме, а кадры всё равно > 30 мс несколько окон подряд — устройство не тянет: предложим лёгкий режим
    if (avg > 0.03 && this.quality <= 0.45) { if (++f.slow >= 3 && !this.slowSent) { this.slowSent = true; this.onSlow?.() } } else if (avg < 0.025) f.slow = 0
    if (this.ceil < this.maxQ && now - this.ceilAt > 15000) { this.ceil = Math.min(this.maxQ, this.ceil + 0.04); this.ceilAt = now }
    if (avg > 0.021 && this.quality > 0.45) {
      this.ceil = Math.max(0.45, this.quality - 0.02); this.ceilAt = now
      this.quality = Math.max(0.45, this.quality - (avg > 0.06 ? 0.15 : avg > 0.03 ? 0.08 : 0.05)); f.good = 0; this.size(false)
    } else if (avg < 0.0168 && this.quality < this.ceil) {
      if (++f.good >= 5) { f.good = 0; this.quality = Math.min(this.ceil, this.quality + 0.04); this.size(false) }
    } else f.good = 0
  }
  tick(now) {
    const gl = this.gl; if (!gl) return
    const raw = (now - this.last) / 1000, dt = Math.min(0.05, raw); this.last = now
    const t = this.reduce ? 3 : (now - this.t0) / 1000
    this.govern(Math.min(0.25, raw), now)
    if (this.trans) {
      const p = Math.min(1, (now - this.trans.start) / this.trans.dur)
      this.mix = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      if (p >= 1) this.finish()
    }
    const tg = this.targets(t), U = this.uB
    this.balls.forEach((b, i) => {
      let tx, ty, tz, tr
      if (i === 0) {
        if (this.mouse.active) { tx = this.mouse.x; ty = this.mouse.y } else {
          // в простое шар-курсор прилипает к первой капле; на десктопе «Услугах» — внутрь лужи
          const oy = !this.mobile && this.chapter === 'services' ? -0.15 : (this.mobile ? 0 : 0.5)
          tx = this.mobile ? tg[0][0] : tg[0][0] - 0.9; ty = tg[0][1] + oy
        }
        tz = 0.3; tr = (this.chapter === 'contact' ? 0.42 : 0.3) * (this.mobile ? 0.7 : 1)
      } else {
        [tx, ty, tz, tr] = tg[i - 1]
      }
      if (this.snapScene) { b.x = tx; b.y = ty; b.z = tz; b.r = tr; b.vx = b.vy = b.vz = 0 }
      const k = i === 0 ? 14 : b.k
      b.vx += (tx - b.x) * k * dt; b.vy += (ty - b.y) * k * dt; b.vz += (tz - b.z) * k * dt
      const damp = Math.pow(i === 0 ? 0.02 : 0.12, dt)
      b.vx *= damp; b.vy *= damp; b.vz *= damp
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt
      b.r += (tr - b.r) * Math.min(1, dt * 3)
      if (this.mobile) {
        const W = H * innerWidth / innerHeight
        const maxW = W * 0.82
        const minY = -H * 0.66
        const maxY = H * 0.76
        if (b.x < -maxW) { b.x = -maxW; b.vx = Math.abs(b.vx) * 0.25 }
        else if (b.x > maxW) { b.x = maxW; b.vx = -Math.abs(b.vx) * 0.25 }
        if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * 0.25 }
        else if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy) * 0.25 }
      }
      U[i * 4] = b.x; U[i * 4 + 1] = b.y; U[i * 4 + 2] = b.z; U[i * 4 + 3] = Math.max(0.01, b.r)
    })
    this.snapScene = false
    const layout = this.layout?.current
    const isBounded = layout?.bounded && !this.mobile
    gl.uniform1f(this.L.bounded, isBounded ? 1 : 0); gl.uniform1f(this.L.shape, this.shapeScale || 1)
    if (isBounded) { const c = layout.clip; gl.uniform4f(this.L.safe, c.x / innerWidth, 1 - (c.y + c.height) / innerHeight, (c.x + c.width) / innerWidth, 1 - c.y / innerHeight) }
    else gl.uniform4f(this.L.safe, 0, 0, 1, 1)
    gl.uniform1f(this.L.time, t); gl.uniform1f(this.L.mix, this.mix); gl.uniform4fv(this.L.b, U)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  destroy() {
    this.layout?.destroy(); this.stop(); clearTimeout(this.idleId); window.cancelIdleCallback?.(this.idleId); document.removeEventListener('visibilitychange', this.onVis); removeEventListener('resize', this.onResize)
    this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); this.el.innerHTML = ''
  }
}
