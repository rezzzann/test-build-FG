
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

  uniform vec4 u_effectRect;
  uniform vec4 u_cardRect;
  uniform vec2 u_effectSize;

  uniform float u_flameHeight;
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
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(7.1, 3.7);
      amplitude *= 0.5;
    }

    return value;
  }

  // =========================================
  // ROUNDED RECTANGLE SDF
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

  // Нормаль к поверхности скруглённой карточки.
  vec2 roundedBoxNormal(
    vec2 p,
    vec2 halfSize,
    float radius
  ) {
    vec2 q = abs(p) - halfSize + radius;
    vec2 outside = max(q, 0.0);

    float outsideLength = length(outside);

    if (outsideLength > 0.0001) {
      return normalize(outside) * sign(p);
    }

    if (q.x > q.y) {
      return vec2(sign(p.x), 0.0);
    }

    return vec2(0.0, sign(p.y));
  }

  // Реальная верхняя граница скруглённой карточки.
  float roundedTopY(
    float x,
    vec2 mn,
    vec2 mx,
    float r
  ) {
    if (x < mn.x + r) {
      float dx = x - (mn.x + r);

      return mx.y - r
        + sqrt(max(r * r - dx * dx, 0.0));
    }

    if (x > mx.x - r) {
      float dx = x - (mx.x - r);

      return mx.y - r
        + sqrt(max(r * r - dx * dx, 0.0));
    }

    return mx.y;
  }

  // Реальная нижняя граница скруглённой карточки.
  float roundedBottomY(
    float x,
    vec2 mn,
    vec2 mx,
    float r
  ) {
    if (x < mn.x + r) {
      float dx = x - (mn.x + r);

      return mn.y + r
        - sqrt(max(r * r - dx * dx, 0.0));
    }

    if (x > mx.x - r) {
      float dx = x - (mx.x - r);

      return mn.y + r
        - sqrt(max(r * r - dx * dx, 0.0));
    }

    return mn.y;
  }

// =========================================
// ROUNDED SIDE BOUNDARY
// Фактическая боковая граница со скруглениями.
// =========================================

// Боковая граница:
// нижнее скругление сохраняется,
// верхняя сторона продолжается строго вертикально.
float roundedSideX(
  float y,
  vec2 mn,
  vec2 mx,
  float r,
  float sideIndex
) {
  float inset = 0.0;

  // Только нижний угол слегка огибается.
  if (y < mn.y + r) {
    float dy = min(
      (mn.y + r) - y,
      r
    );

    inset = r - sqrt(
      max(r * r - dy * dy, 0.0)
    );
  }

  // Выше нижнего угла боковина идёт строго вертикально.
  return mix(
    mn.x + inset,
    mx.x - inset,
    sideIndex
  );
}
  // =========================================
  // ОБЩАЯ ЦВЕТОВАЯ МОДЕЛЬ ОГНЯ
  // Одинаковая палитра для всех слоёв.
  // =========================================

  vec3 firePalette(float heat, float core) {
    vec3 outer = vec3(0.95, 0.075, 0.008);
    vec3 orange = vec3(1.0, 0.25, 0.012);
    vec3 gold = vec3(1.0, 0.60, 0.055);
    vec3 hot = vec3(1.0, 0.93, 0.42);

    vec3 color = mix(
      outer,
      orange,
      smoothstep(0.0, 0.55, heat)
    );

    color = mix(
      color,
      gold,
      smoothstep(0.25, 0.90, heat) * 0.88
    );

    color = mix(
      color,
      hot,
      clamp(core, 0.0, 0.88)
    );

    return color;
  }

  // =========================================
  // MAIN FIRE
  // Верхнее пламя.
  // Сохраняем характер Prototype 002.
  // =========================================

  void main() {

    vec2 uv =
      (v_uv - u_effectRect.xy) / u_effectRect.zw;

    vec2 pixel = uv * u_effectSize;

    float t = u_time * 1.85;

    // Геометрия карточки.
    vec2 cardMin = u_cardRect.xy * u_effectSize;
    vec2 cardSize = u_cardRect.zw * u_effectSize;

    vec2 cardMax = cardMin + cardSize;
    vec2 cardCenter = cardMin + cardSize * 0.5;

    vec2 halfSize = cardSize * 0.5;

    float radius = min(
      u_cardRadius,
      min(halfSize.x, halfSize.y)
    );

    // Расстояние до границы карточки.
    float sd = sdRoundedBox(
      pixel - cardCenter,
      halfSize,
      radius
    );

    // Направление нормали.
    vec2 normal = roundedBoxNormal(
      pixel - cardCenter,
      halfSize,
      radius
    );

    float localX =
      (pixel.x - cardMin.x) / cardSize.x;

    float localY =
      (pixel.y - cardMin.y) / cardSize.y;

    float sideID = step(0.0, normal.x);

    // =========================================
    // LAYER 1 — TOP FIRE
    // =========================================

    float topY = roundedTopY(
      pixel.x,
      cardMin,
      cardMax,
      radius
    );

    float abovePx = pixel.y - topY;

    float fireY = abovePx / u_flameHeight;

    float x = (localX - 0.5) * 2.0;

    float topN1 = fbm(
      vec2(x * 5.2, fireY * 3.4 - t * 2.15)
    );

    float topN2 = fbm(
      vec2(x * 10.5 + 2.4, fireY * 5.5 - t * 3.05)
    );

    float topN3 = fbm(
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
      + 0.28 * topN1
      + 0.12 * topN2;

    height *=
      1.0 - smoothstep(0.86, 1.08, abs(x));

    float edgeNoise =
      (topN1 - 0.5) * 0.10
      + (topN2 - 0.5) * 0.045;

    float bodyEdge =
      height + edgeNoise - fireY;

    float body = smoothstep(
      -0.035,
      0.025,
      bodyEdge
    );

    float fineHeight =
      0.18 + 0.64 * topN2 + 0.18 * tongues;

    float fineShape =
      fineHeight - fireY + (topN3 - 0.5) * 0.11;

    float fine = smoothstep(
      -0.018,
      0.035,
      fineShape
    );

    // Верхний огонь начинается точно от контура,
    // включая скруглённые верхние углы.
    float topXGate =
      smoothstep(-2.0, 2.0, pixel.x - cardMin.x)
      * (
        1.0 - smoothstep(
          -2.0,
          2.0,
          pixel.x - cardMax.x
        )
      );

    float topVerticalGate =
      smoothstep(-1.5, 1.5, abovePx)
      * (
        1.0 - smoothstep(
          0.96,
          1.08,
          fireY
        )
      );

    float edgeFade =
      1.0 - smoothstep(0.94, 1.08, abs(x));

    float base = exp(
      -pow(fireY / 0.055, 2.0)
    );

    float topAlpha = clamp(
      (
        max(body * 0.86, fine * 0.68)
        + base * 0.88
      )
      * edgeFade
      * topXGate
      * topVerticalGate,
      0.0,
      1.0
    );

    float topCore = clamp(
      base * 0.90 + body * 0.14,
      0.0,
      0.85
    );

    float topHeat = clamp(
      smoothstep(0.02, 0.42, bodyEdge)
      + base * 0.35,
      0.0,
      1.0
    );

    vec3 topColor = firePalette(
      topHeat,
      topCore
    );

   // =========================================
// =========================================
// =========================================

    // =========================================
    // LAYER 2 — SIDE FIRE
    // Прямые вертикальные потоки огня.
    // =========================================

    float sideIndex = step(
      cardCenter.x,
      pixel.x
    );

    float sideDirection = mix(
      -1.0,
      1.0,
      sideIndex
    );

    // Боковая граница с нижним скруглением,
    // но без верхнего огибания.
    float sideBoundaryX = roundedSideX(
      pixel.y,
      cardMin,
      cardMax,
      radius,
      sideIndex
    );

    float sideOffset =
      (pixel.x - sideBoundaryX) * sideDirection;

    float sideWeight =
      1.0 - smoothstep(
        12.0,
        26.0,
        abs(sideOffset)
      );

    float sideAlpha = 0.0;
    float sideHeat = 0.0;

    // =========================================
    // ЕДИНАЯ ВЫСОТА ДЛЯ ОБЕИХ БОКОВИН
    // =========================================

    // Верхний шейдер допускает пламя до 1.08
    // высоты u_flameHeight.
    float crownMaximumY =
      cardMax.y + u_flameHeight * 1.08;

    // Боковые языки заканчиваются ровно на 5 px ниже
    // максимальной высоты верхней короны.
    float sideTargetY = crownMaximumY - 5.0;

    // =========================================
    // ВЕРТИКАЛЬНЫЕ ЯЗЫКИ
    // =========================================

    if (sideWeight > 0.01 && abs(sideOffset) < 26.0) {

      for (int i = 0; i < 8; i++) {

        float fi = float(i);

        // Основания распределяются по всей высоте боковины,
        // начиная практически от нижнего угла.
        float rootNoise = noise(
          vec2(
            fi * 2.31 + sideIndex * 9.7,
            sideIndex * 3.1
          )
        );

        float root =
          (
            fi + 0.5
            + (rootNoise - 0.5) * 0.25
          ) / 8.0;

        float rootY = mix(
          cardMin.y + radius,
          cardMax.y - radius,
          root
        );

        // Все языки ориентируются на один уровень окончания.
        float tongueLength = max(
          sideTargetY - rootY,
          8.0
        );

        // Главная ось движения — вверх по экрану.
        float progress =
          (pixel.y - rootY) / tongueLength;

        // Плавное появление у основания
        // и затухание непосредственно перед верхушкой.
        float riseMask =
          smoothstep(0.015, 0.09, progress)
          * (
            1.0 - smoothstep(0.88, 1.0, progress)
          );

        // =========================================
        // ДИНАМИКА
        // =========================================

        float turbulence = fbm(
          vec2(
            fi * 3.7
              + sideIndex * 10.0
              + progress * 3.0,

            localY * 8.0 - t * 2.3
          )
        );

        // Небольшое колебание в стороны.
        // Не меняет вертикального направления огня.
        float sway =
          sin(
            progress * 5.0
            - t * 2.1
            + fi * 2.3
          ) * 1.25
          + (turbulence - 0.5) * 1.3;

        // Основание широкое, верхушка узкая.
        float tongueWidth =
          2.2
          + 8.0
          * pow(
            max(1.0 - progress, 0.0),
            0.76
          )
          * (0.72 + 0.28 * turbulence);

        float crossDistance =
          abs(sideOffset - sway);

        float tongueShape =
          1.0 - smoothstep(
            tongueWidth * 0.25,
            tongueWidth * 1.45,
            crossDistance
          );

        // =========================================
        // ФОРМИРОВАНИЕ ПЛАМЕНИ
        // =========================================

        float lick =
          riseMask
          * tongueShape
          * sideWeight
          * (0.72 + 0.28 * turbulence);

        sideAlpha = max(
          sideAlpha,
          lick * 0.92
        );

        sideHeat = max(
          sideHeat,
          (1.0 - progress * 0.55) * lick
        );
      }
    }

    // =========================================
    // НЕПРЕРЫВНОЕ ОСНОВАНИЕ БОКОВОГО ОГНЯ
    // =========================================

    float sideFlowNoise = fbm(
      vec2(
        localY * 12.0 - t * 2.0 + sideIndex * 3.0,
        t * 0.55
      )
    );

    float sideFlow =
      exp(-pow(sideOffset / 5.0, 2.0));

    float sideBed =
      sideFlow
      * sideWeight
      * (0.20 + 0.14 * sideFlowNoise);

    sideAlpha = max(
      sideAlpha,
      sideBed
    );

    sideHeat = max(
      sideHeat,
      sideBed * 1.4
    );

    // Та же палитра, что у верхнего пламени.
    vec3 sideColor = firePalette(
      clamp(sideHeat, 0.0, 1.0),
      clamp(sideHeat * 0.58, 0.0, 0.72)
    );

    // =========================================
    // LAYER 3 — BOTTOM FIRE
    // Небольшие языки от нижней границы вверх.
    // =========================================

    float bottomWeight = smoothstep(
      0.12,
      0.86,
      -normal.y
    );

    float bottomAlpha = 0.0;
    float bottomHeat = 0.0;

    if (bottomWeight > 0.01 && abs(sd) < 20.0) {

      for (int i = 0; i < 10; i++) {

        float fi = float(i);

        float jitter = noise(
          vec2(fi * 3.71, 2.4)
        );

        float rootX = cardMin.x
          + cardSize.x
          * (
            (fi + 0.5 + (jitter - 0.5) * 0.22)
            / 10.0
          );

        // Основание следует за нижними скруглёнными углами.
        float rootY = roundedBottomY(
          rootX,
          cardMin,
          cardMax,
          radius
        );

        float lengthNoise = noise(
          vec2(fi * 4.9, t * 0.18)
        );

        float tongueLength =
          8.0 + 8.0 * lengthNoise;

        // Пламя поднимается от нижнего края внутрь.
        float progress =
          (pixel.y - rootY) / tongueLength;

        float riseMask =
          smoothstep(0.0, 0.15, progress)
          * (
            1.0 - smoothstep(0.72, 1.0, progress)
          );

        float turbulence = noise(
          vec2(
            fi * 2.6 + localX * 4.0,
            t * 1.7 + progress * 3.0
          )
        );

        float sway =
          sin(
            progress * 4.0
            + t * 2.0
            + fi * 1.8
          ) * 1.4
          + (turbulence - 0.5) * 1.2;

        float tongueWidth =
          2.0
          + 4.5
          * (1.0 - progress)
          * (0.7 + 0.3 * turbulence);

        float crossDistance = abs(
          pixel.x - rootX - sway
        );

        float tongueShape =
          1.0 - smoothstep(
            tongueWidth * 0.40,
            tongueWidth,
            crossDistance
          );

        // Не позволяем нижнему огню уходить глубоко внутрь.
        float innerLimit =
          1.0 - smoothstep(
            12.0,
            18.0,
            max(-sd, 0.0)
          );

        float lick =
          riseMask
          * tongueShape
          * bottomWeight
          * innerLimit
          * step(-0.5, sd);

        bottomAlpha = max(
          bottomAlpha,
          lick * 0.48
        );

        bottomHeat = max(
          bottomHeat,
          (1.0 - progress) * lick
        );
      }
    }

    vec3 bottomColor = firePalette(
      clamp(bottomHeat, 0.0, 1.0),
      clamp(bottomHeat * 0.55, 0.0, 0.65)
    );

    // =========================================
   // =========================================
// LAYER 4 — FULL CARD RIM GLOW
// Непрерывное свечение всех четырёх сторон.
// =========================================

float rimNoise = fbm(
  vec2(
    localX * 14.0 - t * 0.40,
    localY * 14.0 + t * 0.35
  )
);

float rimFlicker =
  0.78 + 0.22 * rimNoise;

// Расстояние до контура.
// SDF автоматически учитывает боковые стороны,
// верхнюю и нижнюю границы и все четыре угла.
float insideDistance = max(-sd, 0.0);
float outsideDistance = max(sd, 0.0);

// =========================================
// ВНУТРЕННЕЕ СВЕЧЕНИЕ
// =========================================

float innerGlow =
  exp(-insideDistance / 15.0)
  * step(sd, 0.0)
  * 0.48
  * rimFlicker;

// =========================================
// ВНЕШНИЙ ОРЕОЛ
// =========================================

float outerGlow =
  exp(-outsideDistance / 15.0)
  * step(0.0, sd)
  * 0.28
  * rimFlicker;

// =========================================
// ЯРКИЙ СВЕТЯЩИЙСЯ КОНТУР
// =========================================

float hotRim =
  exp(-abs(sd) / 2.2)
  * 0.58
  * rimFlicker;

// Дополнительный золотой отблеск.
float goldRim =
  exp(-abs(sd) / 7.0)
  * 0.18
  * rimFlicker;

float glowAlpha = clamp(
  innerGlow
  + outerGlow
  + hotRim
  + goldRim,
  0.0,
  0.88
);

// Цветовая динамика контура.
vec3 glowColor = mix(
  vec3(1.0, 0.12, 0.006),
  vec3(1.0, 0.70, 0.18),
  0.40 + rimFlicker * 0.45
);
    // =========================================
    // FINAL COMPOSITION
    // =========================================

    vec3 resultColor = topColor * topAlpha;
    float resultAlpha = topAlpha;

    // Боковые языки поверх основного огня.
    float sa = clamp(sideAlpha, 0.0, 0.90);

    resultColor =
      sideColor * sa
      + resultColor * (1.0 - sa);

    resultAlpha =
      sa + resultAlpha * (1.0 - sa);

    // Нижний огонь.
    float ba = clamp(bottomAlpha, 0.0, 0.75);

    resultColor =
      bottomColor * ba
      + resultColor * (1.0 - ba);

    resultAlpha =
      ba + resultAlpha * (1.0 - ba);

    // Внутреннее и внешнее свечение поверх пламени.
    float ga = glowAlpha;

    resultColor =
      glowColor * ga
      + resultColor * (1.0 - ga);

    resultAlpha =
      ga + resultAlpha * (1.0 - ga);

    vec3 finalColor =
      resultColor / max(resultAlpha, 0.001);

    gl_FragColor = vec4(
      finalColor,
      clamp(resultAlpha, 0.0, 1.0)
    );
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
// Смешивание прозрачных слоёв огня.
gl.enable(gl.BLEND);

gl.blendFuncSeparate(
  gl.SRC_ALPHA,
  gl.ONE_MINUS_SRC_ALPHA,
  gl.ONE,
  gl.ONE_MINUS_SRC_ALPHA
);
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
  58,
  Math.min(92, seatRect.width * 0.34)
);
    // Выход огня за боковые границы.
    const sidePadding = 26;

    // Небольшое пространство под нижним краем.
    const bottomPadding = 18;

    // Вся область, которую будет обрабатывать шейдер.
    const effectWidth =
      seatRect.width + sidePadding * 2;

   // Полная высота области верхнего пламени,
// включая максимальную точку анимации 1.08.
const topFlameExtent = flameHeight * 1.08;

const effectHeight =
  topFlameExtent
  + seatRect.height
  + bottomPadding;

    // Координаты области относительно стола.
    const effectLeft =
      seatRect.left - innerLeft - sidePadding;

   const effectTop =
  seatRect.top - innerTop - topFlameExtent;

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

