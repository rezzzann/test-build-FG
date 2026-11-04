
export function createFireVfx({ table, seatsRoot }) {
  if (!table || !seatsRoot) {
   return {
  update() {},
  ignite() {},
     startWarmup() {},
flare() {},
  extinguish(callback) {
    callback?.();
  },
     extinguishPlayers(playerIndexes, callback) {
  callback?.();
},
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
  ignite() {},
     startWarmup() {},
flare() {},
  extinguish(callback) {
    callback?.();
  },
     extinguishPlayers(playerIndexes, callback) {
  callback?.();
},
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
uniform float u_fireIntensity;
uniform float u_fireSecondary;
uniform float u_fireSideOpacity;
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
// Нижняя дуга карточки.
// Используется для точного совпадения огня
// с реальным скруглением нижних углов.
float roundedSideX(
  float y,
  vec2 mn,
  vec2 mx,
  float r,
  float sideIndex
) {
  float inset = 0.0;

  if (y < mn.y + r) {
    float dy = min(
      (mn.y + r) - y,
      r
    );

    inset = r - sqrt(
      max(r * r - dy * dy, 0.0)
    );
  }

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
    // LAYER 2 — SIDE FIRE
    // Нижний угол → вся боковая сторона → верхний угол.
    // Выше верхней кромки пламя не выходит.
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

    float cornerRadius = max(radius, 0.001);

    float cornerCenterX = mix(
      cardMin.x + cornerRadius,
      cardMax.x - cornerRadius,
      sideIndex
    );

    float lowerCornerY =
      cardMin.y + cornerRadius;

    float upperCornerY =
      cardMax.y - cornerRadius;

    float cornerArcLength =
      cornerRadius * 1.5707963;

    float straightSideLength =
      max(upperCornerY - lowerCornerY, 0.0);

    // Полная длина бокового контура.
    float sidePathLength =
      cornerArcLength * 2.0
      + straightSideLength;

    float sidePathS = 0.0;
    float sideOffset = 0.0;
    float sidePathGate = 1.0;

    // =========================================
    // НИЖНЕЕ ЗАКРУГЛЕНИЕ
    // =========================================

    if (pixel.y < lowerCornerY) {

      vec2 cornerCenter = vec2(
        cornerCenterX,
        lowerCornerY
      );

      vec2 cornerDelta =
        pixel - cornerCenter;

      float cornerAngle = atan(
        cornerDelta.y,
        cornerDelta.x
      );

      float arcProgress = 0.0;

      if (sideIndex < 0.5) {

        // Нижний левый угол.
        arcProgress =
          (-1.5707963 - cornerAngle) / 1.5707963;

        sidePathGate =
          step(cornerDelta.x, 0.0);

      } else {

        // Нижний правый угол.
        arcProgress =
          (cornerAngle + 1.5707963) / 1.5707963;

        sidePathGate =
          step(0.0, cornerDelta.x);
      }

      arcProgress = clamp(
        arcProgress,
        0.0,
        1.0
      );

      sidePathS =
        cornerArcLength * arcProgress;

      sideOffset =
        length(cornerDelta) - cornerRadius;
    }

    // =========================================
    // ПРЯМАЯ БОКОВАЯ СТОРОНА
    // =========================================

    else if (pixel.y <= upperCornerY) {

      float sideBoundaryX = mix(
        cardMin.x,
        cardMax.x,
        sideIndex
      );

      sidePathS =
        cornerArcLength
        + (pixel.y - lowerCornerY);

      sideOffset =
        (pixel.x - sideBoundaryX) * sideDirection;
    }

    // =========================================
    // ВЕРХНЕЕ ЗАКРУГЛЕНИЕ
    // =========================================

    else {

      vec2 cornerCenter = vec2(
        cornerCenterX,
        upperCornerY
      );

      vec2 cornerDelta =
        pixel - cornerCenter;

      float cornerAngle = atan(
        cornerDelta.y,
        cornerDelta.x
      );

      float arcProgress = 0.0;

      if (sideIndex < 0.5) {

        // Верхний левый угол.
        arcProgress =
          (3.1415926 - cornerAngle) / 1.5707963;

        sidePathGate =
          step(cornerDelta.x, 0.0);

      } else {

        // Верхний правый угол.
        arcProgress =
          cornerAngle / 1.5707963;

        sidePathGate =
          step(0.0, cornerDelta.x);
      }

      arcProgress = clamp(
        arcProgress,
        0.0,
        1.0
      );

      sidePathS =
        cornerArcLength
        + straightSideLength
        + cornerArcLength * arcProgress;

      sideOffset =
        length(cornerDelta) - cornerRadius;

      // Не выпускаем боковое пламя выше
      // верхней горизонтальной кромки карточки.
      sidePathGate *=
        1.0 - smoothstep(
          cardMax.y - 2.0,
          cardMax.y,
          pixel.y
        );
    }

    // =========================================
    // ОБЛАСТЬ БОКОВОГО ПЛАМЕНИ
    // =========================================

    float sideWeight =
      sidePathGate
      * (
        1.0 - smoothstep(
          10.0,
          28.0,
          abs(sideOffset)
        )
      );

    float sideEndFade =
      1.0 - smoothstep(
        sidePathLength - 2.0,
        sidePathLength,
        sidePathS
      );

    float sideAlpha = 0.0;
    float sideHeat = 0.0;

    // =========================================
    // ЯЗЫКИ ПЛАМЕНИ
    // =========================================

    if (
      sideWeight > 0.01
      && sideEndFade > 0.001
    ) {

      for (int i = 0; i < 8; i++) {

        float fi = float(i);

        float rootNoise = noise(
          vec2(
            fi * 2.31 + sideIndex * 9.7,
            sideIndex * 3.1
          )
        );

        // Основания распределены по всей боковой стороне.
        float rootS =
          sidePathLength
          * (fi / 7.0)
          * 0.78;

        if (i > 0) {
          rootS += (rootNoise - 0.5) * 4.0;
        }

        rootS = clamp(
          rootS,
          0.0,
          sidePathLength * 0.82
        );

        float tongueLength = max(
          sidePathLength - rootS,
          8.0
        );

        float progress =
          (sidePathS - rootS) / tongueLength;

        float riseMask =
          smoothstep(
            0.015,
            0.09,
            progress
          )
          * (
            1.0 - smoothstep(
              0.88,
              1.0,
              progress
            )
          );

        // =====================================
        // ДИНАМИКА
        // =====================================

        float turbulence = fbm(
          vec2(
            fi * 3.7
              + sideIndex * 10.0
              + progress * 3.0,

            sidePathS * 0.10 - t * 2.3
          )
        );

        float sway =
          sin(
            progress * 5.0
            - t * 2.1
            + fi * 2.3
          ) * 1.1
          + (turbulence - 0.5) * 1.1;

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

        // =====================================
        // ФОРМИРОВАНИЕ ПЛАМЕНИ
        // =====================================

        float lick =
          riseMask
          * tongueShape
          * sideWeight
          * sideEndFade
          * (0.72 + 0.28 * turbulence);

        sideAlpha = max(
          sideAlpha,
          lick * 0.92
        );

        sideHeat = max(
          sideHeat,
          (1.0 - clamp(progress, 0.0, 1.0) * 0.55)
          * lick
        );
      }
    }

    // =========================================
    // НЕПРЕРЫВНОЕ ОСНОВАНИЕ
    // =========================================

    float sideFlowNoise = fbm(
      vec2(
        sidePathS * 0.10 - t * 2.0 + sideIndex * 3.0,
        t * 0.55
      )
    );

    float sideFlow =
      exp(-pow(sideOffset / 5.0, 2.0));

    float sideBed =
      sideFlow
      * sideWeight
      * sideEndFade
      * (0.20 + 0.14 * sideFlowNoise);

    sideAlpha = max(
      sideAlpha,
      sideBed
    );

    sideHeat = max(
      sideHeat,
      sideBed * 1.4
    );

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
    float sa = clamp(   sideAlpha * u_fireSecondary * u_fireSideOpacity,   0.0,   0.90 );

    resultColor =
      sideColor * sa
      + resultColor * (1.0 - sa);

    resultAlpha =
      sa + resultAlpha * (1.0 - sa);

    // Нижний огонь.
    float ba = clamp(bottomAlpha * u_fireSecondary, 0.0, 0.75);

    resultColor =
      bottomColor * ba
      + resultColor * (1.0 - ba);

    resultAlpha =
      ba + resultAlpha * (1.0 - ba);

    // Внутреннее и внешнее свечение поверх пламени.
    float ga = glowAlpha * u_fireSecondary;

    resultColor =
      glowColor * ga
      + resultColor * (1.0 - ga);

    resultAlpha =
      ga + resultAlpha * (1.0 - ga);

    vec3 finalColor =
      resultColor / max(resultAlpha, 0.001);

  gl_FragColor = vec4(
  finalColor,
  clamp(resultAlpha * u_fireIntensity, 0.0, 1.0)
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
  ignite() {},
     startWarmup() {},
flare() {},
  extinguish(callback) {
    callback?.();
  },
     extinguishPlayers(playerIndexes, callback) {
  callback?.();
},
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
  const fireIntensityLocation = gl.getUniformLocation(
  program,
  'u_fireIntensity'
);
  const fireSecondaryLocation = gl.getUniformLocation(
  program,
  'u_fireSecondary'
);
  const fireSideOpacityLocation = gl.getUniformLocation(
  program,
  'u_fireSideOpacity'
);
  // =========================================
   // =========================================
  // ANIMATION STATE
  // Независимые состояния для каждого игрока.
  // =========================================

  let raf = 0;
  let destroyed = false;

  const startTime = performance.now();

  const playerFireStates = new Map();

  let extinguishCallback = null;
  let extinguishingPlayers = new Set();

  const ease = progress => {
    const p = Math.max(0, Math.min(1, progress));
    return p * p * (3 - 2 * p);
  };

  function requestFireFrame() {
    if (
      !destroyed &&
      !document.hidden &&
      raf === 0
    ) {
      raf = requestAnimationFrame(draw);
    }
  }

  // =========================================
  // START WARMUP
  // =========================================

  function startWarmup(playerIndex, options = {}) {
    if (destroyed || !Number.isInteger(playerIndex)) return;

    const mode = options.mode === 'regular'
      ? 'regular'
      : 'first';

    const startHeight = Number.isFinite(options.startHeight)
      ? options.startHeight
      : 0;

    const endHeight = Number.isFinite(options.endHeight)
      ? options.endHeight
      : 30;

    const initialSideOpacity = Number.isFinite(options.sideOpacity)
      ? options.sideOpacity
      : (mode === 'regular' ? 0 : 1);

    const initialSecondary = Number.isFinite(options.secondary)
      ? options.secondary
      : (mode === 'regular' ? 1 : 0);

    const intensity = mode === 'regular' ? 1 : 0.90;

    extinguishingPlayers.delete(playerIndex);
    extinguishCallback = null;

    playerFireStates.set(playerIndex, {
      phase: 'warmup',
      mode,
      startedAt: performance.now(),

      startHeight,
      endHeight,

      currentHeight: startHeight,
      currentIntensity: intensity,
      currentSecondary: initialSecondary,
      currentSideOpacity: initialSideOpacity
    });

    requestFireFrame();
  }

  // =========================================
  // FLARE
  // Только первый игрок.
  // =========================================

  function flare(playerIndex) {
    if (destroyed) return;

    const state = playerFireStates.get(playerIndex);

    if (!state || state.phase === 'extinguishing') return;

    state.phase = 'flare';
    state.startedAt = performance.now();

    state.flareStartHeight = state.currentHeight;
    state.flareStartIntensity = state.currentIntensity;

    requestFireFrame();
  }

  // =========================================
  // IGNITE
  // =========================================

  function ignite(playerIndex) {
    if (destroyed || !Number.isInteger(playerIndex)) return;

    const state = playerFireStates.get(playerIndex);

    if (!state) {
      startWarmup(playerIndex, {
        mode: 'regular',
        startHeight: 0,
        endHeight: 30,
        sideOpacity: 0,
        secondary: 1
      });

      return;
    }

    if (state.phase === 'extinguishing') return;

    state.phase = 'burning';
    state.mode = 'regular';
    state.currentHeight = 30;
    state.currentIntensity = 1;
    state.currentSecondary = 1;
    state.currentSideOpacity = 1;

    requestFireFrame();
  }

  // =========================================
  // COMPLETE PLAYER EXTINGUISH
  // =========================================

  function finishExtinguishedPlayer(playerIndex) {
    playerFireStates.delete(playerIndex);
    extinguishingPlayers.delete(playerIndex);

    if (
      extinguishingPlayers.size === 0 &&
      extinguishCallback
    ) {
      const callback = extinguishCallback;
      extinguishCallback = null;
      callback();
    }
  }

  // =========================================
  // EXTINGUISH SELECTED PLAYERS
  // =========================================

  function extinguishPlayers(playerIndexes, onComplete) {
    const targets = [...new Set(playerIndexes)]
      .filter(index => playerFireStates.has(index));

    if (targets.length === 0) {
      onComplete?.();
      return;
    }

    extinguishCallback =
      typeof onComplete === 'function'
        ? onComplete
        : null;

    extinguishingPlayers = new Set(targets);

    const now = performance.now();

    targets.forEach(playerIndex => {
      const state = playerFireStates.get(playerIndex);

      state.fadeFromHeight =
        state.currentHeight ?? state.endHeight ?? 30;

      state.fadeFromIntensity =
        state.currentIntensity ?? 1;

      state.fadeFromSecondary =
        state.currentSecondary ?? 1;

      state.fadeFromSideOpacity =
        state.currentSideOpacity ?? 1;

      state.phase = 'extinguishing';
      state.startedAt = now;
    });

    requestFireFrame();
  }

  // =========================================
  // EXTINGUISH ALL PLAYERS
  // =========================================

  function extinguish(onComplete) {
    extinguishPlayers(
      [...playerFireStates.keys()],
      onComplete
    );
  }

  // =========================================
  // UPDATE INDIVIDUAL PLAYER FIRE
  // =========================================

  function updatePlayerFireState(
    state,
    now,
    baseHeight,
    playerIndex
  ) {
    const elapsed = Math.max(
      0,
      now - state.startedAt
    );

    let height = baseHeight;
    let intensity = 1;
    let secondary = 1;
    let sideOpacity = 1;

    // -----------------------------------------
    // WARMUP
    // -----------------------------------------

    if (state.phase === 'warmup') {
      const progress = Math.min(elapsed / 1000, 1);
      const eased = ease(progress);

      if (state.mode === 'regular') {
        // Последующие игроки:
        // верхнее пламя 0 → 30 px.
        height = 30 * eased;

        // Боковое пламя 0 → 100%.
        sideOpacity = eased;

        intensity = 1;
        secondary = 1;

        if (progress >= 1) {
          state.phase = 'burning';
        }

      } else {
        // Первый игрок:
        // сохраняем действующую анимацию 0 → 30 px.
        height =
          state.startHeight
          + (state.endHeight - state.startHeight) * eased;

        intensity = 0.90;
        secondary = 0;
        sideOpacity = 1;

        if (progress >= 1) {
          state.phase = 'ready';
          height = state.endHeight;
        }
      }
    }

    // -----------------------------------------
    // READY
    // Первый игрок ждёт завершения кругового света.
    // -----------------------------------------

    else if (state.phase === 'ready') {
      height = state.endHeight;
      intensity = 0.90;
      secondary = 0;
      sideOpacity = 1;
    }

    // -----------------------------------------
    // FLARE
    // Только первый игрок.
    // -----------------------------------------

    else if (state.phase === 'flare') {
      const intensityProgress = Math.min(
        elapsed / 900,
        1
      );

      if (intensityProgress < 0.22) {
        const p = intensityProgress / 0.22;
        const eased = ease(p);

        intensity =
          state.flareStartIntensity
          + (1.16 - state.flareStartIntensity) * eased;

      } else {
        const p = (intensityProgress - 0.22) / 0.78;
        const eased = ease(p);

        intensity = 1.16 + (1.0 - 1.16) * eased;
      }

      if (elapsed < 450) {
        const progress = elapsed / 450;
        const eased = ease(progress);

        height =
          state.flareStartHeight
          + (60 - state.flareStartHeight) * eased;

        secondary = eased;

      } else if (elapsed < 550) {
        height = 60;
        secondary = 1;

      } else if (elapsed < 850) {
        const progress = (elapsed - 550) / 300;
        const eased = ease(progress);

        height =
          60 + (baseHeight - 60) * eased;

        secondary = 1;

      } else {
        height = baseHeight;
        secondary = 1;
        state.phase = 'burning';
      }

      sideOpacity = 1;
    }

    // -----------------------------------------
    // NORMAL BURNING
    // -----------------------------------------

    else if (state.phase === 'burning') {
      height = state.mode === 'regular'
        ? 30
        : baseHeight;

      intensity = 1;
      secondary = 1;
      sideOpacity = 1;
    }

    // -----------------------------------------
    // EXTINGUISHING
    // -----------------------------------------

    else if (state.phase === 'extinguishing') {
      const progress = Math.min(elapsed / 850, 1);
      const eased = ease(progress);

      height = state.fadeFromHeight;

      intensity =
        state.fadeFromIntensity * (1 - eased);

      secondary =
        state.fadeFromSecondary * (1 - eased);

      sideOpacity =
        state.fadeFromSideOpacity * (1 - eased);

      if (progress >= 1) {
        finishExtinguishedPlayer(playerIndex);
        return null;
      }
    }

    state.currentHeight = height;
    state.currentIntensity = intensity;
    state.currentSecondary = secondary;
    state.currentSideOpacity = sideOpacity;

    return {
      height,
      intensity,
      secondary,
      sideOpacity
    };
  }
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

  // Если карточки временно отсутствуют,
  // всё равно завершаем запущенное затухание.
  if (!activeSeats.length) {
    [...playerFireStates.entries()].forEach(
      ([playerIndex, state]) => {
        if (state.phase === 'extinguishing') {
          updatePlayerFireState(
            state,
            now,
            30,
            playerIndex
          );
        }
      }
    );

    clearCanvas();
    requestFireFrame();
    return;
  }

  const tableWidth = table.clientWidth;
  const tableHeight = table.clientHeight;

  if (!tableWidth || !tableHeight) {
    requestFireFrame();
    return;
  }

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
    const playerIndex = Number(seat.dataset.playerIndex);

    const state = playerFireStates.get(playerIndex);

    if (!state) return;

    const seatRect = seat.getBoundingClientRect();

    if (!seatRect.width || !seatRect.height) return;

    // =========================================
    // ИНДИВИДУАЛЬНОЕ СОСТОЯНИЕ ОГНЯ
    // =========================================

    const baseFlameHeight = Math.max(
      17,
      Math.min(30, seatRect.height * 0.38)
    );

    const fireState = updatePlayerFireState(
      state,
      now,
      baseFlameHeight,
      playerIndex
    );

    if (!fireState) return;

    const flameHeight = Math.max(
      0.001,
      fireState.height
    );

    // =========================================
    // GEOMETRY
    // =========================================

    const sidePadding = 32;
    const bottomPadding = 32;

    const effectWidth =
      seatRect.width + sidePadding * 2;

    const topFlameExtent = flameHeight * 1.08;

    const effectHeight =
      topFlameExtent
      + seatRect.height
      + bottomPadding;

    const effectLeft =
      seatRect.left - innerLeft - sidePadding;

    const effectTop =
      seatRect.top - innerTop - topFlameExtent;

    const effectBottom =
      effectTop + effectHeight;

    // =========================================
    // CARD GEOMETRY
    // =========================================

    const cardX =
      sidePadding / effectWidth;

    const cardY =
      bottomPadding / effectHeight;

    const cardW =
      seatRect.width / effectWidth;

    const cardH =
      seatRect.height / effectHeight;

    const computedStyle = getComputedStyle(seat);

    const bottomLeftRadius =
      parseFloat(computedStyle.borderBottomLeftRadius) || 12;

    const bottomRightRadius =
      parseFloat(computedStyle.borderBottomRightRadius) || 12;

    const radiusValue =
      (bottomLeftRadius + bottomRightRadius) * 0.5;

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
      fireIntensityLocation,
      fireState.intensity
    );

    gl.uniform1f(
      fireSecondaryLocation,
      fireState.secondary
    );

    gl.uniform1f(
      fireSideOpacityLocation,
      fireState.sideOpacity
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

  requestFireFrame();
}
  // =========================================
  // UPDATE
  // =========================================

function update() {
  if (destroyed) return;

  const activeSeats = seatsRoot.querySelectorAll(
    '.seat.allin-flame-active'
  );

  const shouldAnimate =
    activeSeats.length > 0 ||
    playerFireStates.size > 0;

  if (shouldAnimate) {
    requestFireFrame();
  } else {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

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
  ignite,
  startWarmup,
  flare,
  extinguish,
  extinguishPlayers,
  destroy
};
}

