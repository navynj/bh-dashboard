import { redirect } from 'next/navigation';

const page = () => {
  redirect('/dashboard/location');
};

export default page;
