'use client';

import FormField from '@/components/common/FormField';
import FormSelect from '@/components/common/FormSelect';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ROLES } from '@/constants/role';
import { api } from '@/lib/api';
import { ClassName } from '@/types/className';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Location } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const onboardingSchema = z
  .object({
    name: z.string().min(1, 'Display name is required'),
    role: z.enum(['manager', 'office', 'admin']),
    locationId: z.string().optional(),
  })
  .refine(
    (data) =>
      data.role !== 'manager' ||
      (data.locationId && data.locationId.length > 0),
    { message: 'Location is required for managers', path: ['locationId'] },
  );

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps extends ClassName {
  locations: Location[];
  userName?: string | null;
}

export function OnboardingForm({
  locations,
  userName,
  className,
}: OnboardingFormProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: userName ?? '',
      role: 'manager',
      locationId: '',
    },
  });

  const role = watch('role');

  const submitHandler = async (data: OnboardingFormValues) => {
    const result = await api('/onboarding', {
      method: 'POST',
      body: {
        name: data.name,
        role: data.role,
        locationId: data.role === 'manager' ? data.locationId : undefined,
      },
    });

    if (!result.ok) return;

    router.refresh();
    router.push('/');
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Office and manager roles require approval from an admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <FormField
            label="Display name"
            htmlFor="name"
            error={errors.name?.message}
          >
            <Input id="name" {...register('name')} placeholder="Your name" />
          </FormField>

          {/* Role */}
          <FormField label="Role" htmlFor="role" error={errors.role?.message}>
            <FormSelect
              name="role"
              control={control}
              options={ROLES}
              placeholder="Select role"
              onValueChange={(v) =>
                v !== 'manager' && setValue('locationId', '')
              }
            />
          </FormField>

          {/* Location (only for managers) */}
          {role === 'manager' && (
            <FormField
              label="Location"
              htmlFor="location"
              error={errors.locationId?.message}
            >
              <FormSelect
                name="locationId"
                control={control}
                options={locations.map((loc) => ({
                  value: loc.id,
                  label: `${loc.code} – ${loc.name}`,
                }))}
                placeholder="Select location"
              />
            </FormField>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner />
                <span className="sr-only">Saving…</span>
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
