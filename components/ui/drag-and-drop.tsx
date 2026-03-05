'use client';
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { Dispatch, PropsWithChildren, SetStateAction } from 'react';

export interface DroppableProps<T extends { id: string }> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  onDragEnd?: (event: DragEndEvent) => void;
  skipDndContext?: boolean;
}

const Droppable = <T extends { id: string }>({
  items,
  setItems,
  onDragEnd,
  skipDndContext = false,
  children,
}: PropsWithChildren<DroppableProps<T>>) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items: T[]) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }

    onDragEnd?.(event);
  };

  const itemIds = React.useMemo(() => items.map((item) => item.id), [items]);

  const sortableContext = (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );

  if (skipDndContext) {
    // When used inside a table, SortableContext renders as a div
    // We need to make it display as table-row-group (like tbody) to avoid hydration errors
    // CSS will handle making SortableContext's div display correctly
    return sortableContext;
  }

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      {sortableContext}
    </DndContext>
  );
};

interface DraggableProps<T extends { id: string }> {
  id: string;
}

const Draggable = <T extends { id: string }>({
  id,
  children,
}: PropsWithChildren<DraggableProps<T>>) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexShrink: 0, // prevent item from squeezing when dragging in a flex context
  };

  return (
    <>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // Handle ref merging - refs can't be passed directly via cloneElement
          const childRef = (child as any).ref;
          const mergedRef = (node: HTMLElement | null) => {
            setNodeRef(node);
            if (typeof childRef === 'function') {
              childRef(node);
            } else if (childRef && 'current' in childRef) {
              childRef.current = node;
            }
          };

          return React.cloneElement(child, {
            ...attributes,
            ...listeners,
            ref: mergedRef,
            style: {
              ...(child.props as any).style,
              ...style,
            },
          } as any);
        }
        return child;
      })}
    </>
  );
};

export { Draggable, Droppable };
