'use client';

import { useRef, useState } from 'react';
import { ActionIcon, Badge, Progress, Stack, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconPhotoPlus, IconX } from '@tabler/icons-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaViewer } from '@lawless-intranet/media-ui';
import type { MediaFileRecord } from '@lawless-intranet/types';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import type { LetterFormImage } from '../hooks/useLetterImageUploads';
import classes from '../letters.module.scss';

/** Draft images as viewer files (ids are the list keys: nothing is saved yet). */
function toViewerFiles(images: LetterFormImage[], createdAt: string): MediaFileRecord[] {
  return images.map((image) => ({
    id: image.key,
    folderId: null,
    name: image.name,
    mimeType: image.mimeType,
    size: image.size,
    uploadedById: '',
    createdAt,
    updatedAt: createdAt,
    previewUrl: image.previewUrl,
    shareToken: null,
  }));
}

/** Local `blob:` URL of a draft image, or the signed URL of a saved one. */
function downloadImage(image: LetterFormImage | undefined) {
  if (!image?.previewUrl) return;
  const link = document.createElement('a');
  link.href = image.previewUrl;
  link.download = image.name;
  link.rel = 'noopener';
  link.click();
}

function ImageTile({
  image,
  index,
  onRemove,
  onOpen,
}: {
  image: LetterFormImage;
  index: number;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.key });
  return (
    <div
      ref={setNodeRef}
      className={classes.tile}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
        cursor: isDragging ? 'grabbing' : 'zoom-in',
        boxShadow: isDragging ? 'var(--disp-shadow-lg)' : undefined,
      }}
      title="Cliquer pour agrandir · glisser pour réordonner"
      // A drag (6 px or more) never ends in a click: the tile opens only on a plain click.
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      {image.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL or signed URL
        <img src={image.previewUrl} alt={image.name} />
      ) : (
        <Stack h="100%" align="center" justify="center" gap={4} p="xs">
          <IconAlertTriangle size={22} color="var(--disp-danger)" />
        </Stack>
      )}
      <Badge className={classes.tileIndex} size="xs" variant="filled" color="slate" radius="sm">
        {index + 1}
      </Badge>
      <div className={classes.tileActions}>
        <Tooltip label="Retirer">
          <ActionIcon
            size="sm"
            variant="filled"
            color="slate"
            aria-label={`Retirer ${image.name}`}
            // The tile is draggable: the button must not start a drag.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
      {image.status === 'uploading' ? (
        <Progress className={classes.tileProgress} value={image.progress * 100} size="sm" color="sage" animated />
      ) : null}
      {image.status === 'error' ? (
        <Text className={classes.tileProgress} size="xs" c="danger" fw={600} bg="var(--disp-surface)" p={2}>
          {image.error}
        </Text>
      ) : null}
    </div>
  );
}

/** Sortable thumbnails of a letter's images (1 = first page); `compact` for the message bar. */
export function LetterImageTiles({
  images,
  onRemove,
  onReorder,
  compact = false,
}: {
  images: LetterFormImage[];
  onRemove: (key: string) => void;
  onReorder: (images: LetterFormImage[]) => void;
  compact?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = images.findIndex((image) => image.key === active.id);
    const to = images.findIndex((image) => image.key === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(images, from, to));
  };
  const { formatRpDate } = useRpCalendar();
  /** Opened page; kept within the list when images are removed while viewing. */
  const [viewing, setViewing] = useState<{ index: number; openedAt: string } | null>(null);
  const viewerIndex = viewing && images.length > 0 ? Math.min(viewing.index, images.length - 1) : null;

  if (images.length === 0) return null;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images.map((image) => image.key)} strategy={rectSortingStrategy}>
        <div className={compact ? classes.tilesCompact : classes.tiles}>
          {images.map((image, index) => (
            <ImageTile
              key={image.key}
              image={image}
              index={index}
              onRemove={() => onRemove(image.key)}
              onOpen={() => setViewing({ index, openedAt: new Date().toISOString() })}
            />
          ))}
        </div>
      </SortableContext>
      <MediaViewer
        files={viewing ? toViewerFiles(images, viewing.openedAt) : []}
        index={viewerIndex}
        onIndexChange={(index) => setViewing((current) => (current ? { ...current, index } : current))}
        onDownload={(key) => downloadImage(images.find((image) => image.key === key))}
        // Local previews do not expire; saved ones are fresh when the edit form opens.
        onExpired={() => undefined}
        onClose={() => setViewing(null)}
        formatDate={(iso) => formatRpDate(new Date(iso), 'd MMMM yyyy')}
      />
    </DndContext>
  );
}

/** Images of a letter: drop, paste or browse; drag the tiles to reorder (1 = first page). */
export function LetterImagesField({
  images,
  onAdd,
  onRemove,
  onReorder,
  accept,
}: {
  images: LetterFormImage[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onReorder: (images: LetterFormImage[]) => void;
  accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Images de la lettre
      </Text>
      <button
        type="button"
        className={classes.dropzone}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAdd(Array.from(event.dataTransfer.files));
        }}
      >
        <IconPhotoPlus size={26} stroke={1.5} />
        <Text size="sm" fw={600}>
          Glissez, collez (Ctrl/Cmd + V) ou cliquez pour ajouter
        </Text>
        <Text size="xs">Captures de la lettre, dans l’ordre des pages</Text>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={accept}
        onChange={(event) => {
          onAdd(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
        }}
      />
      <LetterImageTiles images={images} onRemove={onRemove} onReorder={onReorder} />
    </Stack>
  );
}
