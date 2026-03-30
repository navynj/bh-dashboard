import { redirect } from 'next/navigation';

const page = () => {
  redirect('/dashboard/budget');
};

export default page;
