'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical } from '@tabler/icons-react';
import classes from './SpeciesPage.module.scss';
import type { SpeciesDTO } from './types';

function countVariants(species: SpeciesDTO): number {
  return species.subspecies.reduce((sum, sub) => sum + sub.variants.length, 0);
}

export function SortableSpeciesItem({
  item,
  active,
  sortable,
  onSelect,
}: {
  item: SpeciesDTO;
  active: boolean;
  sortable: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !sortable });

  const variantsCount = countVariants(item);

  return (
    <div
      ref={setNodeRef}
      className={`${classes.speciesItemWrap} ${isDragging ? classes.isDragging : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {sortable ? (
        <button
          type="button"
          className={classes.dragHandle}
          aria-label={`Réordonner ${item.name}`}
          {...attributes}
          {...listeners}
        >
          <IconGripVertical size={16} stroke={1.5} />
        </button>
      ) : null}
      <button
        type="button"
        className={`${classes.speciesItem} ${active ? classes.speciesItemActive : ''}`}
        onClick={onSelect}
      >
        <span className={classes.speciesName}>{item.name}</span>
        <span className={classes.speciesMeta}>
          {item.subspecies.length} sous-espèce
          {item.subspecies.length === 1 ? '' : 's'} · {variantsCount} variante
          {variantsCount === 1 ? '' : 's'}
        </span>
      </button>
    </div>
  );
}
