export function areAllIdsSelected(selectedIds: ReadonlySet<string>, ids: readonly string[]) {
  return ids.length > 0 && ids.every((id) => selectedIds.has(id));
}

export function toggleSelectedId(selectedIds: ReadonlySet<string>, id: string) {
  const next = new Set(selectedIds);

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return next;
}

export function toggleAllIds(selectedIds: ReadonlySet<string>, ids: readonly string[]) {
  const next = new Set(selectedIds);
  const shouldSelectAll = !areAllIdsSelected(selectedIds, ids);

  for (const id of ids) {
    if (shouldSelectAll) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }

  return next;
}
