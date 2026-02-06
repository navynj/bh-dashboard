import { Label } from '../ui/label';

const FormField = ({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) => {
  return (
    <div>
      <div className="space-y-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {children}
      </div>
      {error && <p className="p-1 text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default FormField;
