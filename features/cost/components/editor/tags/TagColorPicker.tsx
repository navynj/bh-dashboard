'use client';

import { Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/utils';

const TAG_COLORS = [
  { value: 'red', label: 'Red', className: 'bg-red-tone' },
  { value: 'orange', label: 'Orange', className: 'bg-orange-tone' },
  { value: 'yellow', label: 'Yellow', className: 'bg-yellow-tone' },
  { value: 'green', label: 'Green', className: 'bg-green-tone' },
  { value: 'blue', label: 'Blue', className: 'bg-blue-tone' },
  { value: 'purple', label: 'Purple', className: 'bg-purple-tone' },
  { value: 'pink', label: 'Pink', className: 'bg-pink-tone' },
  { value: 'brown', label: 'Brown', className: 'bg-brown-tone' },
  { value: 'gray', label: 'Gray', className: 'bg-gray-400' },
] as const;

export const getColorClassName = (color: string) => {
  return TAG_COLORS.find((c) => c.value === color)?.className || 'bg-gray-400';
};

interface TagColorPickerProps {
  color: string;
  onColorChange: (color: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function TagColorPicker({
  color,
  onColorChange,
  disabled = false,
  className,
}: TagColorPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-4 h-4 rounded-full',
            getColorClassName(color),
            !disabled &&
              'hover:scale-105 hover:shadow-md transition-all duration-200',
            className
          )}
          aria-label="Select color"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {TAG_COLORS.map((colorOption) => (
          <DropdownMenuItem
            key={colorOption.value}
            onClick={() => onColorChange(colorOption.value)}
            className="flex items-center gap-2"
          >
            <div
              className={cn('w-4 h-4 rounded-full', colorOption.className)}
            />
            <span>{colorOption.label}</span>
            {color === colorOption.value && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
