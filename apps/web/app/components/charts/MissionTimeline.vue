<script setup lang="ts">
/**
 * Frise « Tes missions dans le temps » (Clients.dc.html l. 69 à 90) : piste crème, barre colorée par mission, hachures et
 * bord en tirets pour une piste, bord droit ouvert pour une mission sans fin, et la ligne « Creux de CA ».
 * Le nom de la mission et sa barre ouvrent la même mission (`select(id)`).
 */
type Row = {
  id: string;
  name: string;
  sub: string;
  leftPct: number;
  widthPct: number;
  openEnd: boolean;
  prospect: boolean;
  dimmed: boolean;
  selected: boolean;
  color: { base: string; fg: string; soft: string };
  label: string;
  aria: string;
};

defineProps<{
  months: string[];
  rows: Row[];
  gaps: { label: string; low: boolean }[];
  gapMessage: { text: string; tone: 'warn' | 'ok' };
  ariaLabel?: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();

/** Barre pleine, ou hachurée à bord pointillé pour une piste (la couleur n’est pas le seul signal : le trait aussi). */
function fill(row: Row): Record<string, string> {
  const { base, fg, soft } = row.color;
  return {
    background: row.prospect ? `repeating-linear-gradient(135deg, ${soft} 0 10px, #fff 10px 20px)` : base,
    color: row.prospect ? '#4A2E99' : fg,
    border: row.prospect ? `2px dashed ${base}` : '0',
    borderRadius: row.openEnd ? '12px 0 0 12px' : '12px',
    boxShadow: row.selected ? '0 0 0 3px var(--ink)' : 'none',
  };
}
const columns = (n: number, gap = ''): Record<string, string> => ({ gridTemplateColumns: `repeat(${n}, 1fr)`, ...(gap ? { gap } : {}) });
</script>

<template>
  <div class="frieze">
    <div class="scroll">
      <div class="timeline" role="group" :aria-label="ariaLabel ?? 'Tes missions dans le temps'">
        <div class="line" aria-hidden="true">
          <span />
          <div class="months" :style="columns(months.length)">
            <span v-for="(month, i) in months" :key="i">{{ month }}</span>
          </div>
        </div>
        <div v-for="row in rows" :key="row.id" class="line">
          <button type="button" class="name" :aria-pressed="row.selected" @click="emit('select', row.id)">
            <span class="title">{{ row.name }}</span>
            <span class="sub">{{ row.sub }}</span>
          </button>
          <div class="track">
            <button
              v-if="row.widthPct > 0"
              type="button"
              class="hit"
              :style="{ left: `${row.leftPct}%`, width: `${row.widthPct}%`, opacity: row.dimmed ? 0.45 : 1 }"
              :aria-label="row.aria"
              :aria-pressed="row.selected"
              @click="emit('select', row.id)"
            >
              <span class="fill" :style="fill(row)">{{ row.label }}</span>
            </button>
          </div>
        </div>
        <div class="line">
          <span class="gap-title">Creux de CA</span>
          <div class="gaps" role="img" :style="columns(gaps.length, '3px')" :aria-label="`Creux de CA, mois par mois : ${gaps.map((g) => g.label).join(', ')}`">
            <span v-for="(gap, i) in gaps" :key="i" class="gap" :class="{ low: gap.low }" :title="gap.label" />
          </div>
        </div>
      </div>
    </div>
    <div class="message" :class="gapMessage.tone" aria-live="polite">{{ gapMessage.text }}</div>
  </div>
</template>

<style scoped>
.frieze { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
/* Le défilement reste dans la carte ; la marge négative laisse la place du contour de focus sans décaler la mise en page. */
.scroll { overflow-x: auto; padding: 5px; margin: -5px; }
.timeline { min-width: 720px; display: flex; flex-direction: column; gap: 10px; }
.line { display: grid; grid-template-columns: 150px 1fr; gap: 14px; align-items: center; }
.months { display: grid; font-size: 13px; color: var(--muted); font-weight: 700; }
.months span { border-left: 1.5px solid var(--border); padding-left: 6px; }
.name { min-height: 48px; border: 0; background: transparent; text-align: left; cursor: pointer; display: flex; flex-direction: column; justify-content: center; font: inherit; color: var(--ink); padding: 0; }
.title { font-weight: 700; font-size: 16px; }
.sub { font-size: 13px; color: var(--muted); }
.track { position: relative; height: 48px; border-radius: 14px; background: #FBF5EC; }
/* Zone de clic sur toute la hauteur de la piste (48 px) ; la barre visible garde ses 4 px de marge. */
.hit { position: absolute; top: 0; bottom: 0; min-width: 44px; padding: 4px 0; border: 0; background: transparent; cursor: pointer; display: flex; font: inherit; }
.fill { flex: 1; min-width: 0; display: flex; align-items: center; padding: 0 12px; overflow: hidden; white-space: nowrap; font-weight: 700; font-size: 14px; }
.gap-title { font-weight: 700; font-size: 15px; color: #9A3F08; }
.gaps { display: grid; height: 28px; }
.gap { border-radius: 8px; background: var(--border-soft); }
.gap.low { background: var(--client-orange); }
.message { padding: 14px 18px; border-radius: 18px; font-size: 16px; font-weight: 600; }
.message.warn { background: #FFE1CC; color: var(--red-ink); }
.message.ok { background: #E7F6EC; color: #1E6B3A; }
</style>
