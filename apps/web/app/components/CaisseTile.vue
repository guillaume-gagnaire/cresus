<script setup lang="ts">
import type { ArticleDto } from '@cresus/shared';
import { formatEuros } from '~/utils/format';

const props = defineProps<{ article: ArticleDto; count: number; touched: boolean; bump: number }>();
const emit = defineEmits<{ sell: [] }>();
const price = computed(() => formatEuros(props.article.priceCents));
</script>

<template>
  <button type="button" class="tile" :class="{ touched }" :aria-label="`Vendre ${article.name}, ${price}`" @click="emit('sell')">
    <span class="top">
      <PictoImg :name="article.name" :picto="article.picto" :size="56" class="img" />
      <span :key="touched ? bump : 'still'" class="badge num" :class="{ pop: touched }" data-testid="count">{{ count }}</span>
    </span>
    <span class="bottom">
      <span class="name">{{ article.name }}</span>
      <span class="price num">{{ price }}</span>
    </span>
  </button>
</template>

<style scoped>
.tile {
  position: relative;
  min-height: 140px;
  padding: 16px;
  border: 0;
  border-radius: var(--radius-card);
  background: var(--card);
  color: var(--ink);
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  box-shadow: var(--shadow-card);
  touch-action: manipulation;
  user-select: none;
  transition: transform 260ms var(--spring), box-shadow 200ms ease-out;
}
.tile:active {
  transform: scale(0.96);
  transition-duration: 90ms;
}
.tile.touched {
  box-shadow: var(--shadow-touched);
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.badge {
  min-width: 38px;
  height: 38px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--ground);
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
.touched .badge {
  background: var(--coral);
  color: #fff;
}
.badge.pop {
  animation: pop 380ms var(--spring);
}
@keyframes pop {
  35% {
    transform: scale(1.38);
  }
}
.bottom {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.price {
  font-size: 16px;
  font-weight: 700;
  color: var(--muted);
}
@media (min-width: 900px) {
  .tile {
    min-height: 168px;
    padding: 18px;
    border-radius: 26px;
  }
  .img {
    width: 68px !important;
    height: 68px !important;
  }
  .badge {
    min-width: 42px;
    height: 42px;
    font-size: 19px;
  }
  .name {
    font-size: 20px;
  }
  .price {
    font-size: 17px;
  }
}
</style>
