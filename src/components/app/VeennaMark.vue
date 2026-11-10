<script setup lang="ts">
/**
 * The veenna mark, drawn rather than loaded.
 *
 * Geometry is a transcription of the original artwork: concentric hexagonal
 * rings of dots thinning outwards, with four pairs near the middle fused into
 * metaball "bones". They take the current text colour, which is how the app
 * wears the mark. `plate` adds the app-icon squircle behind them (a
 * superellipse of exponent 5.4, not a rounded rect) in white with a hairline
 * edge, for the places that want the packaged icon rather than the mark.
 *
 * The rings are real groups rather than one flat list, so `animate` can send a
 * pulse out through them. Keep them in order: the ripple staggers on position.
 */

withDefaults(
  defineProps<{
    /** Draw the app-icon plate. Off: bare dots in `currentColor`. */
    plate?: boolean
    /** Pulse outward from the centre, once every few seconds. */
    animate?: boolean
    /** Bump this number to send a pulse right now, e.g. on click. The
     * interval pulse carries on from there. Needs `animate`. */
    pulse?: number
  }>(),
  { plate: false, animate: false, pulse: 0 },
)
</script>

<template>
  <g>
    <template v-if="plate">
      <path
        fill="#f0f0f0"
        d="M192.1 96.05C192.1 105.72 192.27 115.4 192.07 125.06C191.87 134.72 192.83 144.79 190.9 154.03C188.98 163.28 186.67 174.38 180.53 180.53C174.38 186.67 163.28 188.98 154.03 190.9C144.79 192.83 134.72 191.87 125.06 192.07C115.4 192.27 105.72 192.1 96.05 192.1C86.38 192.1 76.7 192.27 67.04 192.07C57.38 191.87 47.31 192.83 38.07 190.9C28.82 188.98 17.72 186.67 11.57 180.53C5.43 174.38 3.12 163.28 1.2 154.03C-0.73 144.79 0.23 134.72 0.03 125.06C-0.17 115.4 0 105.72 0 96.05C-0 86.38 -0.17 76.7 0.03 67.04C0.23 57.38 -0.73 47.31 1.2 38.07C3.12 28.82 5.43 17.72 11.57 11.57C17.72 5.43 28.82 3.12 38.07 1.2C47.31 -0.73 57.38 0.23 67.04 0.03C76.7 -0.17 86.38 0 96.05 0C105.72 -0 115.4 -0.17 125.06 0.03C134.72 0.23 144.79 -0.73 154.03 1.2C163.28 3.12 174.38 5.43 180.53 11.57C186.67 17.72 188.98 28.82 190.9 38.07C192.83 47.31 191.87 57.38 192.07 67.04C192.27 76.7 192.1 86.38 192.1 96.05Z"
      />
      <path
        fill="#fefefe"
        d="M186.6 96.05C186.6 105.17 186.76 114.29 186.57 123.4C186.39 132.51 187.28 142 185.47 150.71C183.66 159.43 181.49 169.9 175.69 175.69C169.9 181.49 159.43 183.66 150.71 185.47C142 187.28 132.51 186.39 123.4 186.57C114.29 186.76 105.17 186.6 96.05 186.6C86.93 186.6 77.81 186.76 68.7 186.57C59.59 186.39 50.1 187.28 41.39 185.47C32.67 183.66 22.2 181.49 16.41 175.69C10.61 169.9 8.44 159.43 6.63 150.71C4.82 142 5.71 132.51 5.53 123.4C5.34 114.29 5.5 105.17 5.5 96.05C5.5 86.93 5.34 77.81 5.53 68.7C5.71 59.59 4.82 50.1 6.63 41.39C8.44 32.67 10.61 22.2 16.41 16.41C22.2 10.61 32.67 8.44 41.39 6.63C50.1 4.82 59.59 5.71 68.7 5.53C77.81 5.34 86.93 5.5 96.05 5.5C105.17 5.5 114.29 5.34 123.4 5.53C132.51 5.71 142 4.82 150.71 6.63C159.43 8.44 169.9 10.61 175.69 16.41C181.49 22.2 183.66 32.67 185.47 41.39C187.28 50.1 186.39 59.59 186.57 68.7C186.76 77.81 186.6 86.93 186.6 96.05Z"
      />
    </template>

    <!-- Keyed on `pulse`: a new value remounts the rings, which restarts the ripple at once. -->
    <g :key="pulse" :fill="plate ? '#0d0d0d' : 'currentColor'" :class="animate && 'vm-ripple'">
      <!-- Centre and inner ring: four fused pairs. -->
      <g class="vm-ring">
        <path
          d="M94.31 92.13A5.92 5.92 0 1 1 90.2 98.98A8.4 8.4 0 0 0 79.53 92.62A5.98 5.98 0 1 1 83.66 85.73A8.4 8.4 0 0 0 94.31 92.13Z"
        />
        <path
          d="M112.45 80.38A6.27 6.27 0 1 1 108.03 87.5A8.4 8.4 0 0 0 97.56 80.86A5.97 5.97 0 1 1 101.86 73.94A8.4 8.4 0 0 0 112.45 80.38Z"
        />
        <path
          d="M107.9 107.72A6.31 6.31 0 1 1 112.28 114.94A8.4 8.4 0 0 0 101.66 121.09A5.71 5.71 0 1 1 97.54 114.27A8.4 8.4 0 0 0 107.9 107.72Z"
        />
        <path
          d="M73.94 113.79A6.28 6.28 0 1 1 82.06 113.79A8.4 8.4 0 0 0 81.83 126.4A5.68 5.68 0 1 1 74.17 126.4A8.4 8.4 0 0 0 73.94 113.79Z"
        />
      </g>

      <!-- Second ring. -->
      <g class="vm-ring">
        <circle cx="58.95" cy="97.65" r="5.9" /><circle cx="133.22" cy="97.65" r="5.9" />
        <circle cx="77.91" cy="65.55" r="5.7" /><circle cx="114.2" cy="65.55" r="5.73" />
        <circle cx="114.18" cy="130.58" r="5.79" />
      </g>

      <!-- Third ring. -->
      <g class="vm-ring">
        <circle cx="58.86" cy="75.25" r="5.42" /><circle cx="133.31" cy="75.25" r="5.44" />
        <circle cx="96.03" cy="55.59" r="4.57" /><circle cx="96.02" cy="141.07" r="4.62" />
        <circle cx="59.08" cy="119.96" r="5.53" /><circle cx="133.24" cy="119.94" r="5.49" />
      </g>

      <!-- Fourth ring. -->
      <g class="vm-ring">
        <circle cx="40.77" cy="86.59" r="3.16" /><circle cx="151.32" cy="86.6" r="3.15" />
        <circle cx="40.77" cy="108.15" r="3.15" /><circle cx="151.34" cy="108.16" r="3.14" />
        <circle cx="59.29" cy="55.27" r="2.59" /><circle cx="132.89" cy="55.27" r="2.59" />
        <circle cx="77.5" cy="46.4" r="2.64" /><circle cx="114.7" cy="46.4" r="2.65" />
        <circle cx="77.2" cy="150.46" r="2.66" /><circle cx="114.92" cy="150.46" r="2.66" />
        <circle cx="59.29" cy="140.49" r="2.57" /><circle cx="132.9" cy="140.49" r="2.57" />
      </g>

      <!-- Outermost ring. -->
      <g class="vm-ring">
        <circle cx="42.08" cy="66.85" r="2.09" /><circle cx="150.1" cy="66.84" r="2.09" />
        <circle cx="96.06" cy="37.71" r="2.09" /><circle cx="96.05" cy="158.58" r="2.09" />
        <circle cx="42.13" cy="128.55" r="2.09" /><circle cx="150.1" cy="128.55" r="2.08" />
      </g>
    </g>
  </g>
</template>

<style scoped>
/*
 * A pulse leaves the centre and runs out through the rings, then the mark rests
 * for five seconds or so before the next one. Each ring swells about the centre
 * of the dot field — (96.05, 97.65) in viewBox units, which sits a little below
 * the middle of the plate — so the rings move apart and back rather than drift.
 *
 * The swell is what you see at welcome-screen size. It carries about two pixels
 * out at the rim at 80px, but under half of one in a 24px nav, where on its own
 * it would read as antialiasing noise rather than motion — so the ring dips in
 * opacity on the same beat. Small, the pulse reads as a shimmer; large, as a
 * breath; and it is one set of keyframes either way.
 *
 * Plain CSS on purpose: the Animations switch in Appearance already lands every
 * animation on its final frame through `html[data-animations='off']`.
 */
.vm-ring {
  transform-box: view-box;
  transform-origin: 96.05px 97.65px;
}

.vm-ripple > .vm-ring {
  animation: vm-ripple 6s ease-in-out infinite;
}

.vm-ripple > .vm-ring:nth-child(2) {
  animation-delay: 0.1s;
}

.vm-ripple > .vm-ring:nth-child(3) {
  animation-delay: 0.2s;
}

.vm-ripple > .vm-ring:nth-child(4) {
  animation-delay: 0.3s;
}

.vm-ripple > .vm-ring:nth-child(5) {
  animation-delay: 0.4s;
}

@keyframes vm-ripple {
  0%,
  11%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  5% {
    transform: scale(1.055);
    opacity: 0.6;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vm-ripple > .vm-ring {
    animation: none;
  }
}
</style>
