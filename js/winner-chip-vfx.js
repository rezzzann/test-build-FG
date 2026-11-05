export function createWinnerChipVfx() {
  let canvas = null;
  let gl = null;
  let program = null;
  let buffer = null;
  let texture = null;
  let attribs = null;
  let uniforms = null;
  let coinCanvas = null;
  let flashCanvas = null;
  let flashContext = null;
  let raf = 0;
  let startTime = 0;
  let running = false;
  let landed = false;
  let targetElement = null;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let fadeTimer = null;
  let fadeToken = 0;
  let resolveAnimation = null;

  const duration = 2100;
  const slowStart = 500;
  const firstSlowEnd = 1100;
  const extraSlowEnd = 2100;
  const slowEnd = 2600;
  const slowFactor = 8;
  const extraSlowFactor = 12;

  const elapsedAtFirstSlowEnd =
    slowStart + (firstSlowEnd - slowStart) / slowFactor;

  const elapsedAtExtraSlowEnd =
    elapsedAtFirstSlowEnd +
    (extraSlowEnd - firstSlowEnd) / extraSlowFactor;

  const elapsedAtSlowEnd =
    elapsedAtExtraSlowEnd +
    (slowEnd - extraSlowEnd) / slowFactor;

  const realDuration =
    slowEnd + Math.max(0, duration - elapsedAtSlowEnd);

  function makeShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  function resize() {
    if (!canvas || !gl) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);

    if (flashCanvas) {
      flashCanvas.width = canvas.width;
      flashCanvas.height = canvas.height;

      flashCanvas.style.width = `${width}px`;
      flashCanvas.style.height = `${height}px`;

      flashContext = flashCanvas.getContext('2d');
      flashContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function drawCoinTexture(amount) {
    if (!coinCanvas) return;

    const ctx = coinCanvas.getContext('2d');
    const w = 512;
    const h = 512;

    ctx.clearRect(0, 0, w, h);

    const gradient = ctx.createRadialGradient(
      180, 135, 20,
      260, 260, 300
    );

    gradient.addColorStop(0, '#fff2a6');
    gradient.addColorStop(.22, '#e8bd4f');
    gradient.addColorStop(.52, '#9c6519');
    gradient.addColorStop(.72, '#f7d76e');
    gradient.addColorStop(1, '#6f3e09');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    ctx.beginPath();
    ctx.arc(256, 256, 238, 0, Math.PI * 2);
    ctx.clip();

    for (let i = 0; i < 28; i++) {
      ctx.strokeStyle = i % 2
        ? '#fff0a944'
        : '#4c260a66';

      ctx.lineWidth = i % 3 === 0 ? 3 : 1;

      ctx.beginPath();
      ctx.arc(256, 256, 203 + i * 1.1, 0, Math.PI * 2);
      ctx.stroke();
    }

    const inner = ctx.createRadialGradient(
      180, 140, 10,
      256, 256, 225
    );

    inner.addColorStop(0, '#3d2b0c');
    inner.addColorStop(.48, '#17140e');
    inner.addColorStop(.8, '#2d1b07');
    inner.addColorStop(1, '#6e430e');

    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(256, 256, 194, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff0a7';
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.arc(256, 256, 190, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#ffd34d';
    ctx.shadowBlur = 18;

    ctx.fillStyle = '#fff1ad';
    ctx.font = '900 48px system-ui,Arial';
    ctx.fillText('ALL IN', 256, 174);

    ctx.font = '1000 61px system-ui,Arial';
    ctx.fillText('WINNER', 256, 242);

    ctx.shadowBlur = 10;

    ctx.font = '900 37px system-ui,Arial';
    ctx.fillStyle = '#ffe08a';

    ctx.fillText(
      `+${new Intl.NumberFormat('ru-RU').format(Number(amount) || 0)}`,
      256,
      315
    );

    ctx.font = '900 24px system-ui,Arial';
    ctx.fillText('POKEREZA PP', 256, 355);

    ctx.restore();

    const gloss = ctx.createLinearGradient(80, 20, 430, 480);

    gloss.addColorStop(0, '#ffffff80');
    gloss.addColorStop(.18, '#ffffff00');
    gloss.addColorStop(.55, '#ffffff00');
    gloss.addColorStop(.67, '#ffffff22');
    gloss.addColorStop(1, '#ffffff00');

    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      coinCanvas
    );
  }

  function buildCylinder(segments = 96) {
    const vertices = [];

    function addVertex(position, uv, normal, face) {
      vertices.push(
        position[0], position[1], position[2],
        uv[0], uv[1],
        normal[0], normal[1], normal[2],
        face
      );
    }

    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      const b = (i + 1) / segments * Math.PI * 2;

      const p1 = [Math.cos(a), Math.sin(a), .09];
      const p2 = [Math.cos(b), Math.sin(b), .09];

      // Лицевая сторона.
      addVertex([0, 0, .09], [.5, .5], [0, 0, 1], 1);

      addVertex(
        p1,
        [-p1[0] * .5 + .5, p1[1] * .5 + .5],
        [0, 0, 1],
        1
      );

      addVertex(
        p2,
        [-p2[0] * .5 + .5, p2[1] * .5 + .5],
        [0, 0, 1],
        1
      );

      const q1 = [Math.cos(a), Math.sin(a), -.09];
      const q2 = [Math.cos(b), Math.sin(b), -.09];

      // Обратная сторона.
      addVertex([0, 0, -.09], [.5, .5], [0, 0, -1], 1);

      addVertex(
        q2,
        [q2[0] * .5 + .5, q2[1] * .5 + .5],
        [0, 0, -1],
        1
      );

      addVertex(
        q1,
        [q1[0] * .5 + .5, q1[1] * .5 + .5],
        [0, 0, -1],
        1
      );

      // Боковая поверхность.
      const n1 = [Math.cos(a), Math.sin(a), 0];
      const n2 = [Math.cos(b), Math.sin(b), 0];

      addVertex(p1, [i / segments, 1], n1, 0);
      addVertex(q1, [i / segments, 0], n1, 0);

      addVertex(
        q2,
        [(i + 1) / segments, 0],
        n2,
        0
      );

      addVertex(p1, [i / segments, 1], n1, 0);

      addVertex(
        q2,
        [(i + 1) / segments, 0],
        n2,
        0
      );

      addVertex(
        p2,
        [(i + 1) / segments, 1],
        n2,
        0
      );
    }

    return new Float32Array(vertices);
  }

  let mesh = null;

  function initGL() {
    if (canvas) return !!gl;

    canvas = document.createElement('canvas');
    canvas.id = 'winnerChipGL';
    canvas.setAttribute('aria-hidden', 'true');

    canvas.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100%',
      'height:100%',
      'z-index:5000',
      'pointer-events:none',
      'display:none',
      'opacity:0',
      'transition:opacity .38s ease'
    ].join(';');

    document.body.appendChild(canvas);

    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false
      });

      if (!gl) return false;

      const vertexSource = `
        attribute vec3 aPosition;
        attribute vec2 aUV;
        attribute vec3 aNormal;
        attribute float aFace;

        uniform vec2 uResolution;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform vec2 uRotate;

        varying vec2 vUV;
        varying vec3 vNormal;
        varying float vFace;
        varying float vDepth;

        void main() {
          float cy = cos(uRotate.x);
          float sy = sin(uRotate.x);
          float cx = cos(uRotate.y);
          float sx = sin(uRotate.y);

          vec3 p = aPosition;

          p = vec3(
            p.x * cy + p.z * sy,
            p.y,
            p.z * cy - p.x * sy
          );

          p = vec3(
            p.x,
            p.y * cx - p.z * sx,
            p.y * sx + p.z * cx
          );

          float persp = 1.0 / (1.0 + p.z * 0.16);

          vec2 px = uCenter + vec2(p.x, -p.y) * uRadius * persp;

          vec2 clip = vec2(
            px.x / uResolution.x * 2.0 - 1.0,
            1.0 - px.y / uResolution.y * 2.0
          );

          gl_Position = vec4(clip, p.z * 0.18, 1.0);

          vUV = aUV;
          vNormal = p;
          vFace = aFace;
          vDepth = p.z;
        }
      `;

      const fragmentSource = `
        precision mediump float;

        uniform sampler2D uTexture;
        uniform float uShimmer;

        varying vec2 vUV;
        varying vec3 vNormal;
        varying float vFace;
        varying float vDepth;

        void main() {
          vec3 n = normalize(vNormal);

          float light = max(
            0.0,
            dot(n, normalize(vec3(-0.45, 0.7, 1.0)))
          );

          if (vFace > 0.5) {
            vec4 tex = texture2D(uTexture, vUV);

            float shine =
              pow(
                max(
                  0.0,
                  1.0 - distance(vUV, vec2(0.32, 0.78)) * 1.5
                ),
                12.0
              ) * 0.35;

            float sweepPos = mix(-0.35, 1.35, uShimmer);

            float sweepCoord =
              vUV.x * 0.78 + vUV.y * 0.62;

            float sweepBand =
              1.0 - smoothstep(
                0.025,
                0.19,
                abs(sweepCoord - sweepPos)
              );

            float sweepEnvelope =
              sin(3.14159265 * uShimmer);

            float shimmer =
              max(0.0, sweepBand * sweepEnvelope) * 0.58;

            vec3 shimmerColor = mix(
              vec3(1.0, 0.72, 0.25),
              vec3(1.0, 0.96, 0.72),
              0.7
            );

            gl_FragColor = vec4(
              min(
                tex.rgb + shine + shimmerColor * shimmer,
                vec3(1.0)
              ),
              tex.a
            );

          } else {
            float band = 0.5 + 0.5 * sin(vUV.x * 220.0);

            vec3 gold = mix(
              vec3(0.30, 0.12, 0.015),
              vec3(1.0, 0.77, 0.22),
              0.35 + light * 0.55 + band * 0.1
            );

            float glint =
              pow(
                max(0.0, 1.0 - abs(vUV.x - 0.32) * 10.0),
                8.0
              );

            gl_FragColor = vec4(
              min(gold + glint * 0.55, vec3(1.0)),
              1.0
            );
          }
        }
      `;

      const vertexShader = makeShader(
        gl.VERTEX_SHADER,
        vertexSource
      );

      const fragmentShader = makeShader(
        gl.FRAGMENT_SHADER,
        fragmentSource
      );

      program = gl.createProgram();

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }

      gl.useProgram(program);

      attribs = {
        p: gl.getAttribLocation(program, 'aPosition'),
        uv: gl.getAttribLocation(program, 'aUV'),
        n: gl.getAttribLocation(program, 'aNormal'),
        f: gl.getAttribLocation(program, 'aFace')
      };

      uniforms = {
        res: gl.getUniformLocation(program, 'uResolution'),
        center: gl.getUniformLocation(program, 'uCenter'),
        radius: gl.getUniformLocation(program, 'uRadius'),
        rotate: gl.getUniformLocation(program, 'uRotate'),
        tex: gl.getUniformLocation(program, 'uTexture'),
        shimmer: gl.getUniformLocation(program, 'uShimmer')
      };

      buffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clearDepth(1.0);

      texture = gl.createTexture();

      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.LINEAR
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
      );

      coinCanvas = document.createElement('canvas');
      coinCanvas.width = coinCanvas.height = 512;

      mesh = buildCylinder();

      resize();

      return true;

    } catch (error) {
      console.error(
        'Winner chip WebGL initialization failed:',
        error
      );

      gl = null;
      return false;
    }
  }

  function drawCoin(x, y, radius, rotateX, rotateY, shimmer) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.DYNAMIC_DRAW);

    const stride = 9 * 4;

    gl.enableVertexAttribArray(attribs.p);
    gl.vertexAttribPointer(
      attribs.p, 3, gl.FLOAT, false, stride, 0
    );

    gl.enableVertexAttribArray(attribs.uv);
    gl.vertexAttribPointer(
      attribs.uv, 2, gl.FLOAT, false, stride, 3 * 4
    );

    gl.enableVertexAttribArray(attribs.n);
    gl.vertexAttribPointer(
      attribs.n, 3, gl.FLOAT, false, stride, 5 * 4
    );

    gl.enableVertexAttribArray(attribs.f);
    gl.vertexAttribPointer(
      attribs.f, 1, gl.FLOAT, false, stride, 8 * 4
    );

    gl.uniform2f(
      uniforms.res,
      canvas.width,
      canvas.height
    );

    gl.uniform2f(
      uniforms.center,
      x * dpr,
      y * dpr
    );

    gl.uniform1f(
      uniforms.radius,
      radius * dpr
    );

    gl.uniform2f(
      uniforms.rotate,
      rotateX,
      rotateY
    );

    gl.uniform1f(uniforms.shimmer, shimmer);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.tex, 0);

    gl.drawArrays(
      gl.TRIANGLES,
      0,
      mesh.length / 9
    );
  }

  function targetPoint() {
    const rect = targetElement.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;

    return (
      1 +
      c3 * Math.pow(t - 1, 3) +
      c1 * Math.pow(t - 1, 2)
    );
  }

  function flashCtx() {
    if (!flashCanvas) {
      flashCanvas = document.createElement('canvas');

      flashCanvas.style.cssText = [
        'position:fixed',
        'inset:0',
        'width:100%',
        'height:100%',
        'pointer-events:none',
        'z-index:4999',
        'opacity:1',
        'transition:opacity .38s ease'
      ].join(';');

      document.body.appendChild(flashCanvas);

      flashContext = flashCanvas.getContext('2d');

      resize();
    }

    return flashContext;
  }

  function clearFlash() {
    if (flashContext) {
      flashContext.clearRect(0, 0, width, height);
    }
  }

  function renderCoin(now) {
    if (!running || !gl) return;

    const realElapsed = now - startTime;

    let elapsed;

    if (realElapsed <= slowStart) {
      elapsed = realElapsed;

    } else if (realElapsed <= firstSlowEnd) {
      elapsed =
        slowStart +
        (realElapsed - slowStart) / slowFactor;

    } else if (realElapsed <= extraSlowEnd) {
      elapsed =
        elapsedAtFirstSlowEnd +
        (realElapsed - firstSlowEnd) / extraSlowFactor;

    } else if (realElapsed <= slowEnd) {
      elapsed =
        elapsedAtExtraSlowEnd +
        (realElapsed - extraSlowEnd) / slowFactor;

    } else {
      elapsed =
        elapsedAtSlowEnd +
        (realElapsed - slowEnd);
    }

    const target = targetPoint();

    const start = {
      x: width * .5,
      y: height * .5
    };

    const fallT = Math.min(1, elapsed / 1550);
    const eased = easeOutCubic(fallT);

    const x = start.x + (target.x - start.x) * eased;
    const y = start.y + (target.y - start.y) * eased;

    const startRadius = Math.max(width, height) * .82;

    let radius =
      startRadius + (30 - startRadius) * eased;

    if (elapsed > 1450) {
      const land = Math.min(1, (elapsed - 1450) / 250);

      radius = 30 + 5 * (1 - easeOutBack(land));
    }

    if (elapsed > 1700) {
      radius = 30;
    }

    const spin =
      (1 - fallT) * Math.PI * 3.4 +
      Math.min(1, elapsed / 1800) * .12;

    const tilt =
      .16 + Math.sin(elapsed * .018) * .05;

    const shimmer =
      realElapsed >= firstSlowEnd &&
      realElapsed <= extraSlowEnd
        ? (realElapsed - firstSlowEnd) /
          (extraSlowEnd - firstSlowEnd)
        : -1;

    drawCoin(x, y, radius, spin, tilt, shimmer);

    // Вспышка при приземлении.
    if (elapsed > 1450 && elapsed < 1900) {
      const progress = Math.min(
        1,
        (elapsed - 1450) / 450
      );

      const alpha = (1 - progress) * .6;
      const flashRadius = 30 + progress * 42;

      const ctx = flashCtx();

      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createRadialGradient(
        x,
        y + 7,
        2,
        x,
        y + 7,
        flashRadius
      );

      gradient.addColorStop(
        0,
        `rgba(255,230,130,${alpha})`
      );

      gradient.addColorStop(
        .45,
        `rgba(255,166,24,${alpha * .3})`
      );

      gradient.addColorStop(
        1,
        'rgba(255,150,0,0)'
      );

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y + 7, flashRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (realElapsed < realDuration) {
      raf = requestAnimationFrame(renderCoin);

    } else {
      running = false;
      landed = true;

      clearFlash();

      const resolve = resolveAnimation;
      resolveAnimation = null;

      if (resolve) {
        resolve(true);
      }
    }
  }

  function play(target, amount) {
    if (!target || !initGL()) {
      return Promise.resolve(false);
    }

    if (fadeTimer !== null) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }

    fadeToken++;

    if (raf) {
      cancelAnimationFrame(raf);
    }

    running = false;
    landed = false;

    clearFlash();

    targetElement = target;

    drawCoinTexture(amount);
    resize();

    canvas.style.display = 'block';
    canvas.style.opacity = '1';

    if (flashCanvas) {
      flashCanvas.style.display = 'block';
      flashCanvas.style.opacity = '1';
    }

    startTime = performance.now();
    running = true;

    return new Promise(resolve => {
      resolveAnimation = resolve;
      raf = requestAnimationFrame(renderCoin);
    });
  }

  function fadeOut() {
    if (!canvas || (!landed && !running)) {
      return;
    }

    const token = ++fadeToken;

    canvas.style.opacity = '0';

    if (flashCanvas) {
      flashCanvas.style.opacity = '0';
    }

    if (fadeTimer !== null) {
      clearTimeout(fadeTimer);
    }

    fadeTimer = setTimeout(() => {
      if (token !== fadeToken || running) {
        return;
      }

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      clearFlash();

      canvas.style.display = 'none';

      if (flashCanvas) {
        flashCanvas.style.display = 'none';
      }

      landed = false;
      targetElement = null;
      fadeTimer = null;

    }, 400);
  }

  window.addEventListener('resize', () => {
    if (!canvas || !gl) return;

    resize();

    if (landed && targetElement) {
      const target = targetPoint();

      drawCoin(
        target.x,
        target.y,
        30,
        .12,
        .16,
        -1
      );
    }
  });

  return {
    play,
    fadeOut,
    get realDuration() {
      return realDuration;
    }
  };
}
