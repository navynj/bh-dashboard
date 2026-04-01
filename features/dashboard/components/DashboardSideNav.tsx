import { Separator } from '@/components/ui/separator';
import DashboardLinkList from './DashboardLinkList';
import LocationLinkList from './LocationLinkList';

const DashboardSideNav = () => {
  return (
    <nav className="flex flex-col max-sm:flex-row flex-wrap gap-4 pb-2 mb-4 text-lg">
      <DashboardLinkList />
      {/* <Separator className="my-2" /> */}
      {/* <LocationLinkList /> */}
    </nav>
  );
};

export default DashboardSideNav;
