import { prisma } from '@/lib/core/prisma';
import LocationLinkItem from './LocationLinkItem';
import { useSearchParams } from 'next/navigation';

const LocationLinkList = async () => {
  const locations = await prisma.location.findMany({
    where: {
      showBudget: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return (
    <>
      {locations.map((location) => (
        <LocationLinkItem key={location.id} location={location} />
      ))}
    </>
  );
};

export default LocationLinkList;
