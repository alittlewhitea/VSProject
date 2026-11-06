export type MasonryItem = { id: string; width: number; height: number };
export type MasonryTile = { index: number; id: string; column: number; top: number; bottom: number; width: number; height: number; start: number };

/** Exact media dimensions keep the full scroll range stable before images load. */
export function layoutStudioMasonry(items: MasonryItem[], width: number, columns: number, gap: number) {
  if (width <= 0 || columns < 1) return { tiles: [] as MasonryTile[], height: 0 };
  const columnWidth = Math.max(1, (width - gap * (columns - 1)) / columns);
  const ends = Array<number>(columns).fill(0);
  const tiles = items.map((item, index) => {
    const column = ends.indexOf(Math.min(...ends));
    const top = ends[column];
    const height = columnWidth * item.height / item.width;
    ends[column] = top + height + gap;
    return { index, id: item.id, column, top, bottom: top + height, width: columnWidth, height, start: column * (columnWidth + gap) };
  });
  return { tiles, height: items.length ? Math.max(...ends) - gap : 0 };
}

export function studioMasonryWindow(tiles: MasonryTile[], top: number, bottom: number, overscan: number) {
  return tiles.filter(tile => tile.bottom >= top - overscan && tile.top <= bottom + overscan).map(tile => tile.index);
}
