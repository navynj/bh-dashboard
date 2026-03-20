import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ driverId: string }>;
};

export default async function DriverDetailRedirect({ params }: PageProps) {
  const { driverId } = await params;
  redirect(
    `/delivery/overview?driverId=${encodeURIComponent(driverId)}`,
  );
}
