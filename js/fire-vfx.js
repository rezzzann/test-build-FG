
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

  // Геометрия области эффекта.
  uniform vec4 u_effectRect;

  // Геометрия самой карточки внутри области эффекта.
  uniform vec4 u_cardRect;

  // Размер области эффекта в CSS-пикселях.
  uniform vec2 u_effectSize;

  // Высота основного пламени над карточкой.
  uniform float u_flameHeight;

  // Радиус скругления карточки.
  uniform float u_cardRadius;

  // =========================================
  // NOISE
  // =========================================

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

  // =========================================
  // ROUNDED RECTANGLE SDF
  // Геометрия всей карточки игрока.
  // =========================================

  float sdRoundedBox(
    vec2 p,
    vec2 halfSize,
    float radius
  ) {
    vec2 q = abs(p) - halfSize + radius;

    return length(max(q, 0.0))
      + min(max(q.x, q.y), 0.0)
      - radius;
  }

  // =========================================
  // FIRE RENDER
  // =========================================

  vec4 renderFire(vec2 uv, float time) {

    float t = time * 1.85;

    // Перевод координат в пиксели области эффекта.
    vec2 pixel = uv * u_effectSize;

    // Реальные размеры карточки.
    vec2 cardMin = u_cardRect.xy * u_effectSize;
    vec2 cardSize = u_cardRect.zw * u_effectSize;

    vec2 cardMax = cardMin + cardSize;
    vec2 cardCenter = cardMin + cardSize * 0.5;

    // SDF: отрицательное значение внутри карточки,
    // положительное — снаружи.
    float sd = sdRoundedBox(
      pixel - cardCenter,
      cardSize * 0.5,
      u_cardRadius
    );

    float localX =
      (pixel.x - cardMin.x) / cardSize.x;

    float localY =
      (pixel.y - cardMin.y) / cardSize.y;

    // =========================================
    // LAYER 1 — ОСНОВНОЕ ПЛАМЯ НАД КАРТОЧКОЙ
    // =========================================

    float abovePx = pixel.y - cardMax.y;

    float fireY = abovePx / u_flameHeight;

    float x = (localX - 0.5) * 2.0;

    float n1 = fbm(
      vec2(x * 5.2, fireY * 3.4 - t * 2.15)
    );

    float n2 = fbm(
      vec2(x * 10.5 + 2.4, fireY * 5.5 - t * 3.05)
    );

    float n3 = fbm(
      vec2(x * 18.0 - 4.0, fireY * 8.0 - t * 4.0)
    );

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
      1.0 - smoothstep(0.86, 1.08, abs(x));

    float edgeNoise =
      (n1 - 0.5) * 0.10
      + (n2 - 0.5) * 0.045;

    float bodyEdge = height + edgeNoise - fireY;

    float body = smoothstep(
      -0.035,
      0.025,
      bodyEdge
    );

    float fineHeight =
      0.18 + 0.64 * n2 + 0.18 * tongues;

    float fineShape =
      fineHeight - fireY + (n3 - 0.5) * 0.11;

    float fine = smoothstep(
      -0.018,
      0.035,
      fineShape
    );

    // Основание огня остаётся на верхнем крае карточки.
    float edgeFade =
      1.0 - smoothstep(0.92, 1.08, abs(x));

    float aboveGate =
      smoothstep(-2.0, 1.5, abovePx)
      * (1.0 - smoothstep(0.96, 1.08, fireY));

    float base = exp(
      -pow((abovePx - 0.7) / 4.2, 2.0)
    ) * edgeFade;

    float topAlpha = clamp(
      max(body * 0.78, fine * 0.68)
        * edgeFade
        * aboveGate
        + base * 0.95 * aboveGate,
      0.0,
      1.0
    );

    // Цвет основного пламени.
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
      body * 0.72 + base * 0.55,
      0.0,
      0.90
    );

    vec3 topColor = mix(
      outer,
      orange,
      edgeBand
    );

    topColor = mix(
      topColor,
      gold,
      innerBand * 0.85
    );

    topColor = mix(
      topColor,
      hot,
      hotCore
    );

    float topGlow =
      exp(-pow((fireY - 0.18) / 0.25, 2.0))
      * edgeFade
      * 0.18;

    topColor += vec3(1.0, 0.16, 0.015) * topGlow;

    // =========================================
    // LAYER 2 — ОГОНЬ ВОКРУГ БОКОВЫХ КРАЁВ
    // =========================================

    float sideSign = step(0.5, localX);

    float sideN1 = fbm(
      vec2(
        localY * 7.0 + sideSign * 2.2,
        t * 1.1
      )
    );

    float sideN2 = fbm(
      vec2(
        localY * 15.0 - t * 1.6,
        sideSign * 4.0
      )
    );

    // Изменение высоты языков вдоль боковых границ.
    float sidePulse = 0.5
      + 0.28 * sin(
        localY * 28.0 - t * 2.4 + sideSign * 1.7
      )
      + 0.25 * (sideN1 - 0.5)
      + 0.16 * (sideN2 - 0.5);

    sidePulse = clamp(sidePulse, 0.0, 1.0);

    // Дальность распространения бокового пламени.
    float sideReach = 3.0 + sidePulse * 13.0;

    // Не даём боковому огню закрывать весь низ карточки.
    float sideGate =
      smoothstep(0.04, 0.18, localY)
      * (1.0 - smoothstep(0.88, 1.0, localY));

    float sideDistance = max(sd, 0.0);

    float sideMask =
      (1.0 - smoothstep(
        sideReach,
        sideReach + 5.0,
        sideDistance
      ))
      * step(0.0, sd)
      * sideGate
      * smoothstep(0.22, 0.48, sidePulse);

    float sideAlpha = clamp(
      sideMask * (0.50 + sidePulse * 0.50),
      0.0,
      1.0
    );

    vec3 sideColor = mix(
      outer,
      orange,
      smoothstep(0.15, 0.70, sidePulse)
    );

    sideColor = mix(
      sideColor,
      gold,
      smoothstep(0.65, 0.95, sidePulse) * 0.55
    );

    // =========================================
    // LAYER 3 — ВНУТРЕННЕЕ СВЕЧЕНИЕ ПО КОНТУРУ
    // =========================================

    float glowNoise = noise(
      vec2(
        localX * 12.0 - t * 0.45,
        localY * 13.0 + t * 0.35
      )
    );

    float glowFlicker =
      0.68 + 0.32 * glowNoise;

    // Свет только внутри границ карточки.
    float innerGlowBand =
      smoothstep(-11.0, -5.0, sd)
      * (1.0 - smoothstep(-1.5, 1.5, sd));

    float innerGlowAlpha = innerGlowBand
      * (0.18 + 0.18 * glowFlicker);

    // Мягкий внешний ореол.
    float outerGlowBand =
      (1.0 - smoothstep(
        0.0,
        11.0,
        sideDistance
      ))
      * step(0.0, sd);

    float outerGlowAlpha =
      outerGlowBand
      * (0.18 + 0.12 * glowFlicker);

    vec3 rimColor = mix(
      vec3(1.0, 0.13, 0.008),
      vec3(1.0, 0.56, 0.07),
      glowFlicker
    );

    // =========================================
    // FINAL COMPOSITION
    // =========================================

    float flameAlpha = max(
      topAlpha,
      sideAlpha
    );

    float glowAlpha = max(
      innerGlowAlpha,
      outerGlowAlpha
    );

    float alpha = clamp(
      flameAlpha + glowAlpha * (1.0 - flameAlpha),
      0.0,
      1.0
    );

    float sideMix =
      sideAlpha / max(topAlpha + sideAlpha, 0.001);

    vec3 flameColor = mix(
      topColor,
      sideColor,
      sideMix
    );

    // Составляем итоговый цвет с корректной прозрачностью.
    vec3 premultipliedColor =
      flameColor * flameAlpha
      + rimColor * glowAlpha * (1.0 - flameAlpha);

    vec3 finalColor =
      premultipliedColor / max(alpha, 0.001);

    return vec4(finalColor, alpha);
  }

  void main() {

    // Преобразуем глобальные координаты Canvas
    // в координаты локальной области эффекта.
    vec2 localUV =
      (v_uv - u_effectRect.xy) / u_effectRect.zw;

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

const effectRectLocation = gl.getUniformLocation(
  program,
  'u_effectRect'
);

const cardRectLocation = gl.getUniformLocation(
  program,
  'u_cardRect'
);

const effectSizeLocation = gl.getUniformLocation(
  program,
  'u_effectSize'
);

const flameHeightLocation = gl.getUniformLocation(
  program,
  'u_flameHeight'
);

const cardRadiusLocation = gl.getUniformLocation(
  program,
  'u_cardRadius'
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

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniform1f(
    timeLocation,
    (now - startTime) / 1000
  );

  gl.enable(gl.SCISSOR_TEST);

  activeSeats.forEach(seat => {
    const seatRect = seat.getBoundingClientRect();

    if (!seatRect.width || !seatRect.height) return;

    // =========================================
    // GEOMETRY
    // =========================================

    // Высота основного огня над карточкой.
    // Рассчитывается от её фактической ширины.
    const flameHeight = Math.max(
      52,
      Math.min(92, seatRect.width * 0.31)
    );

    // Выход огня за боковые границы.
    const sidePadding = 20;

    // Небольшое пространство под нижним краем.
    const bottomPadding = 12;

    // Вся область, которую будет обрабатывать шейдер.
    const effectWidth =
      seatRect.width + sidePadding * 2;

    const effectHeight =
      flameHeight
      + seatRect.height
      + bottomPadding;

    // Координаты области относительно стола.
    const effectLeft =
      seatRect.left - innerLeft - sidePadding;

    const effectTop =
      seatRect.top - innerTop - flameHeight;

    const effectBottom =
      effectTop + effectHeight;

    // =========================================
    // CARD GEOMETRY
    // =========================================

    // Положение самой карточки внутри области эффекта.
    const cardX =
      sidePadding / effectWidth;

    const cardY =
      bottomPadding / effectHeight;

    const cardW =
      seatRect.width / effectWidth;

    const cardH =
      seatRect.height / effectHeight;

    // Берём реальный радиус скругления .seat.
    const computedStyle = getComputedStyle(seat);

    const radiusValue = parseFloat(
      computedStyle.borderTopLeftRadius
    ) || 12;

    const cardRadius = Math.min(
      radiusValue,
      seatRect.width * 0.5,
      seatRect.height * 0.5
    );

    // =========================================
    // NORMALIZED EFFECT RECT
    // =========================================

    const rectX =
      effectLeft / tableWidth;

    const rectY =
      1 - effectBottom / tableHeight;

    const rectW =
      effectWidth / tableWidth;

    const rectH =
      effectHeight / tableHeight;

    // =========================================
    // SCISSOR
    // Ограничиваем обработку областью карточки.
    // =========================================

    const sx = Math.max(
      0,
      Math.floor(effectLeft * dpr)
    );

    const sy = Math.max(
      0,
      Math.floor(
        (tableHeight - effectBottom) * dpr
      )
    );

    const ex = Math.min(
      canvas.width,
      Math.ceil(
        (effectLeft + effectWidth) * dpr
      )
    );

    const ey = Math.min(
      canvas.height,
      Math.ceil(
        (tableHeight - effectTop) * dpr
      )
    );

    const scissorWidth = ex - sx;
    const scissorHeight = ey - sy;

    if (
      scissorWidth <= 0 ||
      scissorHeight <= 0
    ) return;

    // =========================================
    // SEND GEOMETRY TO SHADER
    // =========================================

    gl.uniform4f(
      effectRectLocation,
      rectX,
      rectY,
      rectW,
      rectH
    );

    gl.uniform4f(
      cardRectLocation,
      cardX,
      cardY,
      cardW,
      cardH
    );

    gl.uniform2f(
      effectSizeLocation,
      effectWidth,
      effectHeight
    );

    gl.uniform1f(
      flameHeightLocation,
      flameHeight
    );

    gl.uniform1f(
      cardRadiusLocation,
      cardRadius
    );

    // =========================================
    // DRAW FIRE
    // =========================================

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

