import {
  Control,
  Controller,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type FormSelectProps<T extends FieldValues> = {
  name: FieldPath<T>;
  control: Control<T>;
  options: { value: string; label: string }[];
  placeholder: string;
  id?: string;
  onValueChange?: (value: string) => void;
};

const FormSelect = <T extends FieldValues>({
  name,
  control,
  options,
  placeholder,
  id = name,
  onValueChange,
}: FormSelectProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={field.value ?? ''}
          onValueChange={(v) => {
            field.onChange(v);
            onValueChange?.(v);
          }}
        >
          <SelectTrigger id={id} className="w-full m-0">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
};

export default FormSelect;
