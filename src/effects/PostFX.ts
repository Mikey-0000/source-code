// WebGL post-processing: CRT curvature-lite, scanlines, chromatic aberration, VHS wobble, vignette. Falls back to plain 2D blit.
import { settings } from '../core/Settings';
import { VIEW_H, VIEW_W } from '../art/Palette';
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*0.5+0.5; uv.y = 1.0-uv.y; gl_Position = vec4(p,0.,1.); }`;
const FS = `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float time, aber, glitch, crt, vig, flash;
float h(float n){ return fract(sin(n*43758.5453)*12.9898); }
void main(){
  vec2 q = uv;
  vec2 c = q-0.5; float r2 = dot(c,c); q = 0.5 + c*(1.0 + crt*0.035*r2);
  float band = step(0.985, h(floor(q.y*45.0)+floor(time*9.0))) * glitch;
  q.x += band*0.04*(h(floor(time*30.0))-0.5)*2.0 + glitch*0.003*sin(q.y*200.0+time*40.0);
  q.x += crt*0.0009*sin(q.y*60.0 + time*2.0);
  float a = aber + glitch*0.006;
  vec3 col; col.r = texture2D(tex, q+vec2(a,0.)).r; col.g = texture2D(tex, q).g; col.b = texture2D(tex, q-vec2(a,0.)).b;
  float scan = 0.5+0.5*sin(q.y*${VIEW_H}.0*6.2831853);
  col *= 1.0 - crt*0.16*scan;
  col *= 1.0 - crt*0.05*step(0.5, fract(q.x*${VIEW_W}.0*0.5));
  col += (h(q.x*91.0+q.y*57.0+time)-0.5)*0.035*crt;
  float v = 1.0 - smoothstep(0.25, 0.95, length(c)*1.25); col *= mix(1.0, v, vig);
  col += vec3(1.0,0.12,0.2)*flash*0.25;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) col = vec3(0.);
  gl_FragColor = vec4(col,1.);
}`;
export class PostFX {
  gl: WebGLRenderingContext | null = null; ctx2d: CanvasRenderingContext2D | null = null; prog!: WebGLProgram; tex!: WebGLTexture;
  glitch = 0; flash = 0; aberr = 0.0008; private u: Record<string, WebGLUniformLocation | null> = {};
  constructor(public out: HTMLCanvasElement) {
    this.gl = out.getContext('webgl', { antialias: false, preserveDrawingBuffer: true }) as WebGLRenderingContext | null;
    if (!this.gl) { this.ctx2d = out.getContext('2d'); if (this.ctx2d) this.ctx2d.imageSmoothingEnabled = false; return; }
    const gl = this.gl; const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'shader'); return o; };
    try {
      this.prog = gl.createProgram()!; gl.attachShader(this.prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(this.prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(this.prog); gl.useProgram(this.prog);
    } catch { this.gl = null; this.ctx2d = out.getContext('2d'); return; }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    for (const n of ['time', 'aber', 'glitch', 'crt', 'vig', 'flash']) this.u[n] = gl.getUniformLocation(this.prog, n);
  }
  resize(w: number, h: number) { const dpr = Math.min(devicePixelRatio || 1, 2); const W = Math.max(320, Math.round(w * dpr)), H = Math.max(180, Math.round(h * dpr)); if (this.out.width !== W || this.out.height !== H) { this.out.width = W; this.out.height = H; } }
  present(src: HTMLCanvasElement, time: number) {
    const reduce = settings.reducedMotion || !settings.flashes;
    if (!this.gl) { const c = this.ctx2d; if (!c) return; c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, this.out.width, this.out.height); return; }
    const gl = this.gl; gl.viewport(0, 0, this.out.width, this.out.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const crt = settings.crt ? 1 : 0;
    gl.uniform1f(this.u.time, time); gl.uniform1f(this.u.aber, settings.crt ? this.aberr : 0); gl.uniform1f(this.u.glitch, reduce ? Math.min(this.glitch, .15) : this.glitch);
    gl.uniform1f(this.u.crt, crt); gl.uniform1f(this.u.vig, settings.crt ? 1 : 0.35); gl.uniform1f(this.u.flash, settings.flashes && !settings.reducedMotion ? this.flash : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
