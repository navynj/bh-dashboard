'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ROLES } from '@/constants/role';
import { api } from '@/lib/api';
import { ClassName } from '@/types/className';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Location } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const onboardingSchema = z
  .object({
    name: z.string().min(1, 'Display name is required'),
    role: z.enum(['manager', 'assistant', 'office', 'admin']),
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
  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: userName ?? '',
      role: 'manager',
      locationId: '',
    },
  });
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
    watch,
  } = form;
  const role = watch('role');

  const submit = async (data: OnboardingFormValues) => {
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
    <Form {...form}>
      <form onSubmit={handleSubmit(submit)} className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Office and manager roles require approval from an admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v !== 'manager') setValue('locationId', '');
                      }}
                    >
                      <SelectTrigger className="w-full m-0">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'manager' && (
              <FormField
                control={control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full m-0">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.code} – {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
    </Form>
  );
}
