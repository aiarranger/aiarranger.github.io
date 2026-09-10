// 3場面のWebGL合成。ワークショップの scene-recipe（キー合成・頂点変形・ワイプ）を海中の生成レイヤーへ読み替えたもの。
// 環境レイヤー（背景・海藻・魚・生き物）は限定色（palette の暗→中→明）に写し、キャラクターだけ本来の色で泡の中に置く。
// 座標は左上原点、x/yは描く画像の中心。W/HはCSSピクセル。
import { config, clamp, smooth } from './config.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export class Scene {
  constructor(canvas, images) {
    this.canvas = canvas; this.images = images;
    const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw Error('WebGLを利用できません。ブラウザの設定をご確認ください。');
    const vertex = `precision mediump float;attribute vec2 uv;varying vec2 tex;uniform vec2 viewport,center,size;uniform float angle,time,kind;
    void main(){tex=uv;vec2 p=uv-.5;
    if(kind==1.){float k=smoothstep(.5,.95,uv.x);p.y+=sin(uv.x*9.-time*3.)*.05*k;p.x+=sin(uv.x*6.-time*3.)*.012*k;}
    if(kind==2.){p.x+=sin(time*.9+uv.y*2.5)*.014*uv.y;p.y+=sin(time*.7+uv.x*2.)*.006;}
    if(kind==3.){p.x+=sin(time*.85+uv.y*2.1+uv.x*3.)*.07*pow(1.-uv.y,1.5);}
    if(kind==4.){p.y+=sin(time*1.6+uv.x*5.)*.035*abs(uv.x-.5)*2.;}
    if(kind==5.){p.y+=sin(time*1.2+uv.x*4.)*.02*uv.y;p.x+=sin(time*.8+uv.y*3.)*.01;}
    p*=size;p=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*p+center;
    gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}`;
    const fragment = `precision mediump float;varying vec2 tex;uniform sampler2D image;uniform vec2 viewport,pixels,focus;uniform vec3 pdark,pmid,plight;uniform float opacity,time,water,reveal,mask,keyed,tint;
    void main(){vec2 uv=tex;if(water>0.){uv.x+=sin(tex.y*26.+time*.8)*.0025+sin(tex.y*12.-time*.6)*.002;uv.y+=sin(tex.x*20.+time*.7)*.0015;}
    vec4 col=texture2D(image,uv);
    if(keyed>0.){float d=distance(col.rgb,vec3(1.,0.,1.));col.a*=smoothstep(.2,.45,d);
      float spill=max(0.,min(col.r,col.b)-col.g-.3);col.r-=spill;col.b-=spill;}
    if(tint>0.){float l=dot(col.rgb,vec3(.299,.587,.114));vec3 lim=l<.5?mix(pdark,pmid,l*2.):mix(pmid,plight,(l-.5)*2.);col.rgb=mix(col.rgb,lim,tint);}
    vec2 screen=vec2(gl_FragCoord.x/pixels.x,1.-gl_FragCoord.y/pixels.y);
    if(mask==1.){float edge=1.-reveal*1.1+.05+sin(screen.x*10.+reveal*6.)*.035;col.a*=smoothstep(edge-.008,edge+.008,screen.y);}
    if(mask==2.){vec2 delta=(screen-focus)*viewport/min(viewport.x,viewport.y);float radius=reveal*length(viewport/min(viewport.x,viewport.y))*1.15;col.a*=1.-smoothstep(radius-.012,radius+.012,length(delta));}
    col.a*=opacity;gl_FragColor=col;}`;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
    const prog = this.program = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.u = {}; for (const n of ['viewport', 'center', 'size', 'angle', 'time', 'kind', 'image', 'opacity', 'water', 'reveal', 'mask', 'pixels', 'focus', 'keyed', 'tint', 'pdark', 'pmid', 'plight']) this.u[n] = gl.getUniformLocation(prog, n);
    this.attr = gl.getAttribLocation(prog, 'uv'); this.meshes = {};
    for (const [key, nx, ny] of [['plain', 1, 1], ['mesh', 48, 24]]) {
      const v = [];
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) v.push(x / nx, y / ny, (x + 1) / nx, y / ny, x / nx, (y + 1) / ny, x / nx, (y + 1) / ny, (x + 1) / nx, y / ny, (x + 1) / nx, (y + 1) / ny);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      this.meshes[key] = { b, count: v.length / 2 };
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.tex = {};
    for (const [name, { source, keyed }] of Object.entries(images)) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.tex[name] = { t, w: source.naturalWidth || source.width, h: source.naturalHeight || source.height, keyed: keyed ? 1 : 0 };
    }
    this.t = 0; this.setPalette(config.palette); this.resize();
  }
  setPalette(name) {
    const p = config.palettes[name] || config.palettes[config.palette]; this.paletteName = config.palettes[name] ? name : config.palette; this.palette = p;
    const gl = this.gl; gl.uniform3fv(this.u.pdark, hex(p.dark)); gl.uniform3fv(this.u.pmid, hex(p.mid)); gl.uniform3fv(this.u.plight, hex(p.light));
    this.clear = hex(p.dark);
  }
  resize(w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio, config.dpr)) {
    this.W = w; this.H = h;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  // w を指定し、高さは画像の縦横比から決める（h指定時はそのまま）。w が負なら左右反転。tint=1 で限定色に写す。
  draw1(name, x, y, w, { h, opacity = 1, kind = 0, angle = 0, water = 0, mask = 0, reveal = 1, focus = [.5, .5], tint = 1 } = {}) {
    const a = this.tex[name]; if (!a || opacity <= 0) return;
    const gl = this.gl, u = this.u, m = this.meshes[kind ? 'mesh' : 'plain'];
    gl.bindBuffer(gl.ARRAY_BUFFER, m.b); gl.enableVertexAttribArray(this.attr); gl.vertexAttribPointer(this.attr, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, a.t); gl.uniform1i(u.image, 0);
    gl.uniform2f(u.viewport, this.W, this.H); gl.uniform2f(u.pixels, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.center, x, y); gl.uniform2f(u.size, w, h ?? Math.abs(w) * a.h / a.w); gl.uniform2f(u.focus, focus[0], focus[1]);
    for (const [k, v] of Object.entries({ opacity, kind, angle, water, mask, reveal, keyed: a.keyed, tint, time: this.t })) gl.uniform1f(u[k], v);
    gl.drawArrays(gl.TRIANGLES, 0, m.count);
  }
  cover(name, z) { const a = this.tex[name]; const s = Math.max(this.W / a.w, this.H / a.h) * z; return [a.w * s, a.h * s]; }
  byHeight(name, h) { const a = this.tex[name]; return h * a.w / a.h; }
  // 泡の中のキャラクター（本来の色）。h はキャラクターの高さ、泡は少し大きい円。
  bubbleChar(name, x, y, h, { angle = 0, opacity = 1, wobble = 0, ...o } = {}) {
    const a = this.tex[name], w = h * a.w / a.h, d = Math.hypot(w, h) * 1.02, t = this.t;
    this.draw1('bubbleBack', x, y, d, { ...o, opacity: opacity * .9, tint: 0, angle: wobble });
    this.draw1(name, x + Math.sin(t * .9 + wobble) * d * .01, y + Math.sin(t * .7) * d * .012, w, { ...o, kind: 2, angle, opacity, tint: 0 });
    this.draw1('bubbleFront', x, y, d, { ...o, opacity: opacity * .95, tint: 0, angle: wobble + Math.sin(t * .3) * .08 });
  }
  // 現在のパレットで場面1の初期構図を w×h に描いて PNG Blob を返す（映像の終景に使う）
  async snapshot(w = 1920, h = 1080) {
    const keep = [this.W, this.H, this.canvas.width, this.canvas.height];
    this.W = w; this.H = h; this.canvas.width = w; this.canvas.height = h; this.gl.viewport(0, 0, w, h);
    this.draw(0, 0);
    const blob = await new Promise((res) => this.canvas.toBlob(res, 'image/png'));
    this.W = keep[0]; this.H = keep[1]; this.canvas.width = keep[2]; this.canvas.height = keep[3]; this.gl.viewport(0, 0, keep[2], keep[3]);
    return blob;
  }

  draw(q, t) {
    const W = this.W, H = this.H, mobile = W < 750, gl = this.gl; this.t = t;
    gl.clearColor(this.clear[0], this.clear[1], this.clear[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const aichanH = H * (mobile ? .24 : .32), kiyoH = H * (mobile ? .17 : .23); // 泡の中のちびあいちゃん・きよごん
    // 手前の海藻は画面の下側だけを占めるよう高さで決め、左右2枚（片方は反転）で幅を埋める
    const kelpH = H * (mobile ? .6 : .62), kelpW = kelpH * this.tex.kelp.w / this.tex.kelp.h;

    // ── 場面1：浅瀬。映像の終景と同じ構図から始まる（q 0〜1.1） ──
    if (q < 1.1) {
      const h = clamp(q / .72), l = smooth((q - .65) / .45);
      const [bw, bh] = this.cover('shallow', 1.06 + .08 * h + .2 * l);
      this.draw1('shallow', W * .5 + Math.sin(t * .14) * .01 * W, H * (.5 - .03 * h + .06 * l), bw, { h: bh });
      this.draw1('fish', W * (.72 - .12 * h + Math.sin(t * .11) * .03), H * (.22 + Math.sin(t * .5) * .01), W * (mobile ? .9 : .5), { kind: 5, opacity: .85 });
      this.draw1('fish', W * (.2 + .1 * h + Math.sin(t * .09 + 2) * .03), H * (.72 + Math.sin(t * .4) * .01), -W * (mobile ? .55 : .3), { kind: 5, opacity: .5 });
      this.draw1('kelp', W * .35 + Math.sin(t * .2) * .01 * W, H - kelpH * .38 + H * (.1 + .3 * l), kelpW * .8, { kind: 3, opacity: .4 });
      this.draw1('kelp', W * .8 + Math.sin(t * .17) * .01 * W, H - kelpH * .3 + H * (.1 + .3 * l), -kelpW * .7, { kind: 3, opacity: .35 });
      // 2人：泡の中で本来の色。あいちゃんは中央やや右、きよごんは右上
      this.bubbleChar('aichan', W * (mobile ? .5 : .6) + Math.sin(t * .4) * .01 * W - .05 * W * l, H * (mobile ? .48 : .48) + Math.sin(t * .6) * .015 * H + .1 * H * l, aichanH, { angle: -.12 + Math.sin(t * .6) * .03, wobble: .2 });
      this.bubbleChar('kiyogon', W * (mobile ? .8 : .84) + Math.sin(t * .35 + 1) * .01 * W + .05 * W * l, H * (mobile ? .24 : .26) + Math.sin(t * .8 + 2) * .02 * H - .1 * H * l, kiyoH, { angle: -.08 + Math.sin(t * .5) * .04, wobble: -.3 });
      this.draw1('kelp', W * .22 + Math.sin(t * .15 + 1) * .01 * W, H - kelpH * .5 + H * (.16 + .55 * l), kelpW, { kind: 3, opacity: .98 });
      this.draw1('kelp', W * .88 + Math.sin(t * .13 + 2) * .01 * W, H - kelpH * .5 + H * (.22 + .55 * l), -kelpW * .9, { kind: 3, opacity: .95 });
    }

    // ── 場面2：中層。下から波の境界で現れ、マンタが横切り、クラゲが昇る（q .7〜2.1） ──
    if (q > .7 && q < 2.1) {
      const phase = q - 1, h = clamp(phase / .72), cross = smooth((phase + .1) / 1.0), l = smooth((phase - .3) / .5);
      const o = q < 1.1 ? { mask: 1, reveal: clamp((q - .7) / .4) } : {};
      const [bw, bh] = this.cover('mid', 1.06 + .12 * h);
      this.draw1('mid', W * (.5 - .03 * h), H * (.5 + .05 * h), bw, { ...o, h: bh, water: 1 });
      this.draw1('fish', W * (.9 - .5 * h), H * .18, W * (mobile ? .6 : .32), { ...o, kind: 5, opacity: .55 });
      const jellyW = this.byHeight('jelly', H * (mobile ? .42 : .6));
      this.draw1('jelly', W * (mobile ? .72 : .78) + Math.sin(t * .3) * .015 * W, H * (1.1 - .7 * h) + Math.sin(t * .6) * .02 * H, jellyW, { ...o, kind: 2, opacity: .96 });
      // 2人は小さく奥へ（泡のまま）
      this.bubbleChar('aichan', W * (mobile ? .68 : .64) + Math.sin(t * .3) * .01 * W, H * (.26 + .05 * h) + Math.sin(t * .5) * .01 * H, aichanH * .7, { ...o, angle: -.1, wobble: .2, opacity: .95 });
      this.bubbleChar('kiyogon', W * (mobile ? .86 : .8) + Math.sin(t * .25 + 1) * .01 * W, H * (.16 + .04 * h) + Math.sin(t * .6) * .01 * H, kiyoH * .7, { ...o, angle: -.06, wobble: -.3, opacity: .95 });
      const mantaW = W * (mobile ? 1.5 : .92);
      this.draw1('manta', W * (-.55 + 1.9 * cross), H * (.62 - .2 * cross) + Math.sin(t * .8) * .02 * H, mantaW, { ...o, kind: 4, angle: -.08 + .1 * cross });
      if (l > 0) this.draw1('manta', W * (1.4 - 1.2 * l), H * (.3 + .1 * l), -mantaW * .45, { ...o, kind: 4, opacity: .7, angle: .06 });
    }

    // ── 場面3：深海。中央の泡から広がって現れ、チョウチンアンコウの灯りの後、2人が光へ上昇（q 1.7〜3.4） ──
    if (q > 1.7) {
      const phase = q - 2, h = clamp(phase / .72), rise = smooth((phase - .4) / .75), come = smooth(h / .6);
      const o = q < 2.1 ? { mask: 2, reveal: clamp((q - 1.7) / .4), focus: [.5, .62] } : {};
      const [bw, bh] = this.cover('deep', 1.1 + .08 * h + .5 * rise);
      this.draw1('deep', W * .5, H * (.5 + .03 * h) + (bh - H) * .5 * rise, bw, { ...o, h: bh });
      this.draw1('glow', W * (.3 + Math.sin(t * .12) * .03), H * (.55 - .05 * h + .3 * rise), W * (mobile ? .7 : .4), { ...o, kind: 2, opacity: .8 });
      this.draw1('glow', W * (.72 + Math.sin(t * .1 + 1) * .03), H * (.3 + .2 * rise), -W * (mobile ? .5 : .3), { ...o, kind: 2, opacity: .5 });
      this.draw1('glow', W * (.5 + Math.sin(t * .08 + 2) * .03), H * (.85 + .4 * rise), W * (mobile ? .6 : .34), { ...o, kind: 2, opacity: .35 });
      const anglerW = W * (mobile ? .62 : .36);
      this.draw1('anglerfish', W * (1.25 - .65 * come) + Math.sin(t * .35) * .01 * W, H * (.56 + Math.sin(t * .7) * .02 + .9 * rise), anglerW, { ...o, kind: 1, angle: -.04 + Math.sin(t * .5) * .03 });
      if (rise > 0) {
        this.bubbleChar('aichan', W * (mobile ? .55 : .66) + Math.sin(t * .5) * .01 * W, H * (1.45 - (mobile ? .9 : 1.0) * rise) + Math.sin(t * .9) * .02 * H, aichanH * 1.1, { ...o, angle: .25 + Math.sin(t * .6) * .025, wobble: .2 });
        this.bubbleChar('kiyogon', W * (mobile ? .82 : .85) + Math.sin(t * .4) * .01 * W, H * (1.7 - (mobile ? .95 : 1.15) * rise) + Math.sin(t * .8 + 2) * .025 * H, kiyoH * 1.1, { ...o, angle: -.1 + Math.sin(t * .5) * .03, wobble: -.3 });
      }
    }
  }
}
