
export function createFireVfx({ table, seatsRoot }) {
  if (!table || !seatsRoot) {
    return {
      update() {},
      destroy() {}
    };
  }

  // Один постоянный Canvas для всего стола.
  const canvas = document.createElement('canvas');

  canvas.className = 'allin-fire-vfx-layer';
  canvas.setAttribute('aria-hidden', 'true');

  table.appendChild(canvas);

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    powerPreference: 'low-power'
  });

  if (!gl) {
    console.warn('Pokereza Fire VFX: WebGL недоступен.');

    canvas.remove();

    return {
      update() {},
      destroy() {}
    };
  }

  // =========================================
  // VERTEX SHADER
  // =========================================

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // =========================================
  // FRAGMENT SHADER
  // Процедурный огонь из Fire VFX Prototype 002
  // =========================================

  const fragmentSource = `
    precision highp float;

    varying vec2 v_uv;

    uniform float u_time;
    uniform vec4 u_fireRect;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      f = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(
          hash(i),
          hash(i + vec2(1.0, 0.0)),
          f.x
        ),
        mix(
          hash(i + vec2(0.0, 1.0)),
          hash(i + vec2(1.0, 1.0)),
          f.x
        ),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;

      for (int i = 0; i < 5; i++) {
        v += a * noise(p);

        p = p * 2.03 + vec2(7.1, 3.7);

        a *= 0.5;
      }

      return v;
    }

    vec4 renderFire(vec2 uv, float time) {

      vec2 localUV = uv;

      float t = time * 1.85;

      // Коррекция под широкое соотношение 2.84:1.
      float x = (localUV.x - 0.5) * 2.0;
      float y = localUV.y;

      // Основное движение огня.
      float n1 = fbm(
        vec2(x * 5.2, y * 3.4 - t * 2.15)
      );

      float n2 = fbm(
        vec2(x * 10.5 + 2.4, y * 5.5 - t * 3.05)
      );

      float n3 = fbm(
        vec2(x * 18.0 - 4.0, y * 8.0 - t * 4.0)
      );

      // Основные языки пламени.
      float tongues = 0.5
        + 0.22 * sin(x * 17.0 + t * 2.0)
        + 0.13 * sin(x * 31.0 - t * 2.5)
        + 0.10 * sin(x * 47.0 + t * 1.65);

      tongues = clamp(tongues, 0.08, 0.94);

      float height =
        0.25
        + 0.42 * tongues
        + 0.28 * n1
        + 0.12 * n2;

      height *=
        (1.0 - smoothstep(0.78, 1.05, abs(x)));

      height = max(height, 0.17);

      float edgeNoise =
        (n1 - 0.5) * 0.10
        + (n2 - 0.5) * 0.045;

      float bodyEdge = height + edgeNoise - y;

      float body = smoothstep(
        -0.035,
        0.025,
        bodyEdge
      );

      // Дополнительные узкие языки.
      float fineHeight =
        0.18 + 0.64 * n2 + 0.18 * tongues;

      float fineShape =
        fineHeight - y + (n3 - 0.5) * 0.11;

      float fine = smoothstep(
        -0.018,
        0.035,
        fineShape
      ) * (
        1.0 - smoothstep(0.68, 1.02, abs(x))
      );

      // Стабильное основание огня.
      float base =
        exp(-pow((y - 0.115) / 0.075, 2.0))
        * (1.0 - smoothstep(0.78, 1.08, abs(x)));

      float core =
        exp(-pow((y - (0.12 + 0.11 * n1)) / 0.19, 2.0))
        * body;

      float tonguesMask = max(
        body * 0.78,
        fine * 0.68
      );

      float alpha = clamp(
        max(tonguesMask, base * 0.92),
        0.0,
        1.0
      );

      // Цветовая палитра.
      float intensity = clamp(
        0.25 + 0.45 * n1 + 0.35 * n2 + 0.24 * n3,
        0.0,
        1.0
      );

      vec3 outer = vec3(0.95, 0.075, 0.008);
      vec3 orange = vec3(1.0, 0.25, 0.012);
      vec3 gold = vec3(1.0, 0.60, 0.055);
      vec3 hot = vec3(1.0, 0.91, 0.34);

      float edgeBand = smoothstep(
        0.02,
        0.20,
        bodyEdge
      );

      float innerBand = smoothstep(
        0.16,
        0.42,
        bodyEdge + 0.10 * n2
      );

      float hotCore = clamp(
        core * 0.92 + base * 0.42,
        0.0,
        1.0
      );

      vec3 color = mix(
        outer,
        orange,
        edgeBand
      );

      color = mix(
        color,
        gold,
        innerBand * (0.68 + 0.22 * intensity)
      );

      color = mix(
        color,
        hot,
        clamp(hotCore, 0.0, 0.82)
      );

      // Светящиеся внутренние прожилки.
      float streak =
        smoothstep(0.72, 0.92, n3)
        * body
        * smoothstep(0.10, 0.35, y);

      color = mix(
        color,
        vec3(1.0, 0.78, 0.16),
        streak * 0.48
      );

      // Мягкое внешнее свечение.
      float glow =
        exp(-pow((y - 0.18) / 0.25, 2.0))
        * (1.0 - smoothstep(0.35, 1.18, abs(x)))
        * 0.22;

      color += vec3(1.0, 0.16, 0.015) * glow;

      // Плавное затухание по верхнему краю.
      float topFade =
        1.0 - smoothstep(0.80, 1.0, y);

      alpha *= mix(1.0, topFade, 0.42);

      alpha = clamp(alpha, 0.0, 1.0);

      return vec4(color, alpha);
    }

    void main() {

      // Переводим координаты всего Canvas
      // в локальные координаты конкретного пламени.
      vec2 localUV =
        (v_uv - u_fireRect.xy) / u_fireRect.zw;

      gl_FragColor = renderFire(localUV, u_time);
    }
  `;

  // =========================================
  // COMPILATION
  // =========================================

  function compileShader(type, source) {
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error('Не удалось создать WebGL shader.');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);

      gl.deleteShader(shader);

      throw new Error(error);
    }

    return shader;
  }

  let program;
  let vertexShader;
  let fragmentShader;

  try {
    vertexShader = compileShader(
      gl.VERTEX_SHADER,
      vertexSource
    );

    fragmentShader = compileShader(
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

  } catch (error) {
    console.error('Pokereza Fire VFX:', error);

    canvas.remove();

    return {
      update() {},
      destroy() {}
    };
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  gl.useProgram(program);

  // =========================================
  // GEOMETRY
  // =========================================

  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]),
    gl.STATIC_DRAW
  );

  const positionLocation = gl.getAttribLocation(
    program,
    'a_position'
  );

  gl.enableVertexAttribArray(positionLocation);

  gl.vertexAttribPointer(
    positionLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );

  const timeLocation = gl.getUniformLocation(
    program,
    'u_time'
  );

  const fireRectLocation = gl.getUniformLocation(
    program,
    'u_fireRect'
  );

  // =========================================
  // ANIMATION STATE
  // =========================================

  let raf = 0;

  let destroyed = false;

  const startTime = performance.now();

  // =========================================
  // CANVAS RESIZE
  // =========================================

  function resizeCanvas() {
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    const width = Math.max(
      1,
      Math.floor(table.clientWidth * dpr)
    );

    const height = Math.max(
      1,
      Math.floor(table.clientHeight * dpr)
    );

    if (
      canvas.width !== width ||
      canvas.height !== height
    ) {
      canvas.width = width;
      canvas.height = height;

      gl.viewport(
        0,
        0,
        width,
        height
      );
    }

    return dpr;
  }

  // =========================================
  // CLEAR
  // =========================================

  function clearCanvas() {
    gl.disable(gl.SCISSOR_TEST);

    gl.clearColor(0, 0, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // =========================================
  // DRAW
  // =========================================

  function draw(now) {
    raf = 0;

    if (destroyed || document.hidden) return;

    const activeSeats = Array.from(
      seatsRoot.querySelectorAll(
        '.seat.allin-flame-active'
      )
    );

    if (!activeSeats.length) {
      clearCanvas();
      return;
    }

    const tableWidth = table.clientWidth;
    const tableHeight = table.clientHeight;

    if (!tableWidth || !tableHeight) return;

    const dpr = resizeCanvas();

    const tableRect = table.getBoundingClientRect();

    const innerLeft =
      tableRect.left + table.clientLeft;

    const innerTop =
      tableRect.top + table.clientTop;

    gl.useProgram(program);

    gl.disable(gl.SCISSOR_TEST);

    gl.clearColor(0, 0, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(
      timeLocation,
      (now - startTime) / 1000
    );

    gl.enable(gl.SCISSOR_TEST);

    activeSeats.forEach(seat => {
      const seatRect = seat.getBoundingClientRect();

      // Ширина рассчитывается по фактической
      // ширине карточки игрока.
      const flameWidth = Math.min(
        seatRect.width + 18,
        tableWidth - 8
      );

      if (flameWidth <= 0) return;

      // Сохраняем пропорции прототипа 2.84:1.
      const flameHeight = flameWidth / 2.84;

      const left =
        seatRect.left -
        innerLeft +
        (seatRect.width - flameWidth) / 2;

      const seatTop =
        seatRect.top - innerTop;

      // В шейдере основание расположено
      // на уровне 11.5% от нижнего края.
      // Совмещаем его с верхней границей карточки.
      const flameTop =
        seatTop - flameHeight * 0.885 - 2;

      const flameBottom =
        flameTop + flameHeight;

      // Нормализованные координаты для GLSL.
      const rectX =
        left / tableWidth;

      const rectY =
        1 - flameBottom / tableHeight;

      const rectW =
        flameWidth / tableWidth;

      const rectH =
        flameHeight / tableHeight;

      // Область отрисовки в физических пикселях.
      // Так шейдер обрабатывает только область огня,
      // а не весь игровой стол.
      const sx = Math.max(
        0,
        Math.floor(left * dpr)
      );

      const sy = Math.max(
        0,
        Math.floor(
          (tableHeight - flameBottom) * dpr
        )
      );

      const ex = Math.min(
        canvas.width,
        Math.ceil((left + flameWidth) * dpr)
      );

      const ey = Math.min(
        canvas.height,
        Math.ceil(
          (tableHeight - flameTop) * dpr
        )
      );

      const scissorWidth = ex - sx;
      const scissorHeight = ey - sy;

      if (
        scissorWidth <= 0 ||
        scissorHeight <= 0
      ) return;

      gl.uniform4f(
        fireRectLocation,
        rectX,
        rectY,
        rectW,
        rectH
      );

      gl.scissor(
        sx,
        sy,
        scissorWidth,
        scissorHeight
      );

      gl.drawArrays(
        gl.TRIANGLE_STRIP,
        0,
        4
      );
    });

    gl.disable(gl.SCISSOR_TEST);

    raf = requestAnimationFrame(draw);
  }

  // =========================================
  // UPDATE
  // =========================================

  function update() {
    if (destroyed) return;

    const hasActiveFire = seatsRoot.querySelector(
      '.seat.allin-flame-active'
    );

    if (
      hasActiveFire &&
      !document.hidden &&
      raf === 0
    ) {
      raf = requestAnimationFrame(draw);
    }

    if (!hasActiveFire && raf !== 0) {
      cancelAnimationFrame(raf);

      raf = 0;

      clearCanvas();
    }
  }

  // =========================================
  // PAGE VISIBILITY
  // =========================================

  function handleVisibility() {
    if (document.hidden) {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    } else {
      update();
    }
  }

  document.addEventListener(
    'visibilitychange',
    handleVisibility
  );

  // =========================================
  // DESTROY
  // =========================================

  function destroy() {
    destroyed = true;

    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    document.removeEventListener(
      'visibilitychange',
      handleVisibility
    );

    canvas.remove();

    gl.getExtension('WEBGL_lose_context')
      ?.loseContext();
  }

  return {
    update,
    destroy
  };
}

